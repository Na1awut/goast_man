"""Compare the TypeScript planner with OR-Tools on the same instances.

Reads bench/routing/instances.json (written by bench.ts) and solves each one
as a single-rider PDPTW with the same constraints as
rout_hack/03_campus_food_delivery/core/pdp_solver.py: pickup before delivery
on the same route, capacity, no pickup before the food is ready, delivery
before the deadline. The route is open (the rider does not return), so a
zero-cost dummy end node is used.

    pip install ortools
    python bench/routing/ortools_compare.py [--time-limit 1.0]

The TypeScript planner searches every stop order, so OR-Tools should never
find a shorter walk. A row with "OR-Tools shorter" > 0 means a planner bug.
"""

import argparse
import json
import statistics
import time
from collections import defaultdict
from pathlib import Path

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

SCALE = 100  # OR-Tools needs integers: work in 1/100 s


def solve(inst, time_limit_s):
    n = inst["n"]
    matrix = inst["matrix"]
    size = 2 * n + 1
    end = size  # dummy end node
    manager = pywrapcp.RoutingIndexManager(size + 1, 1, [0], [end])
    routing = pywrapcp.RoutingModel(manager)

    def transit(i_idx, j_idx):
        i, j = manager.IndexToNode(i_idx), manager.IndexToNode(j_idx)
        if j == end or i == end:
            return 0
        return int(round(matrix[i][j] * SCALE))

    cb = routing.RegisterTransitCallback(transit)
    routing.SetArcCostEvaluatorOfAllVehicles(cb)

    horizon = int((max(d for d in inst["deadline"] if d is not None) if any(inst["deadline"]) else 10_800) * SCALE) + 1
    routing.AddDimension(cb, horizon, horizon, True, "Time")
    time_dim = routing.GetDimensionOrDie("Time")

    def demand(i_idx):
        node = manager.IndexToNode(i_idx)
        if node == 0 or node == end:
            return 0
        return 1 if node % 2 == 1 else -1

    dcb = routing.RegisterUnaryTransitCallback(demand)
    routing.AddDimensionWithVehicleCapacity(dcb, 0, [n], True, "Capacity")

    for i in range(n):
        p = manager.NodeToIndex(2 * i + 1)
        d = manager.NodeToIndex(2 * i + 2)
        routing.AddPickupAndDelivery(p, d)
        routing.solver().Add(routing.VehicleVar(p) == routing.VehicleVar(d))
        routing.solver().Add(time_dim.CumulVar(p) <= time_dim.CumulVar(d))
        time_dim.CumulVar(p).SetMin(int(round(inst["ready"][i] * SCALE)))
        if inst["deadline"][i] is not None:
            time_dim.CumulVar(d).SetMax(int(inst["deadline"][i] * SCALE))

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromMilliseconds(int(time_limit_s * 1000))

    t0 = time.perf_counter()
    sol = routing.SolveWithParameters(params)
    ms = (time.perf_counter() - t0) * 1000
    if sol is None:
        return None, ms

    # Recompute the walk in float seconds from the route, not from the rounded objective
    idx, walk = routing.Start(0), 0.0
    while not routing.IsEnd(idx):
        nxt = sol.Value(routing.NextVar(idx))
        i, j = manager.IndexToNode(idx), manager.IndexToNode(nxt)
        if j != end:
            walk += matrix[i][j]
        idx = nxt
    return walk, ms


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--time-limit", type=float, default=1.0, help="OR-Tools seconds per instance")
    ap.add_argument("--file", default=str(Path(__file__).with_name("instances.json")))
    args = ap.parse_args()

    instances = json.loads(Path(args.file).read_text())
    by_n = defaultdict(list)
    for inst in instances:
        ortools_walk, ortools_ms = solve(inst, args.time_limit)
        by_n[inst["n"]].append((inst["ours"], ortools_walk, ortools_ms))

    tol = 0.05  # seconds: rounding to 1/100 s per leg
    print(f"\nOR-Tools time limit: {args.time_limit}s per instance (GLS keeps searching until the limit)\n")
    header = f"{'orders':>6} {'runs':>5} {'both feasible':>13} {'only ours found':>15} {'only OR-Tools found':>19} {'OR-Tools shorter':>16} {'avg OR-Tools gap':>16} {'max gap':>8} {'ours median ms':>14} {'OR-Tools median ms':>18}"
    print(header)
    print("-" * len(header))
    for n in sorted(by_n):
        rows = by_n[n]
        gaps, both, only_ours, only_ortools, ortools_better = [], 0, 0, 0, 0
        for ours, walk, _ in rows:
            ours_walk = ours["travel"]
            if ours_walk is not None and walk is None:
                only_ours += 1  # OR-Tools ran out of time before finding a route
                continue
            if ours_walk is None and walk is not None:
                only_ortools += 1  # would be a planner bug
                continue
            if ours_walk is None:
                continue
            both += 1
            if walk < ours_walk - tol:
                ortools_better += 1
            gaps.append((walk - ours_walk) / ours_walk * 100 if ours_walk > 0 else 0.0)
        ours_ms = statistics.median(o["ms"] for o, _, _ in rows)
        or_ms = statistics.median(m for _, _, m in rows)
        avg_gap = f"{statistics.mean(gaps):.2f}%" if gaps else "-"
        max_gap = f"{max(gaps):.2f}%" if gaps else "-"
        print(f"{n:>6} {len(rows):>5} {both:>13} {only_ours:>15} {only_ortools:>19} {ortools_better:>16} {avg_gap:>16} {max_gap:>8} {ours_ms:>14.3f} {or_ms:>18.1f}")
    print("\ngap = how much longer OR-Tools walks than the TypeScript planner (0% = same route quality)")
    print("'only ours found' = OR-Tools ran out of time; 'only OR-Tools found' or 'OR-Tools shorter' > 0 = planner bug")


if __name__ == "__main__":
    main()
