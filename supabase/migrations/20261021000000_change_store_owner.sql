-- ============================================================
-- Allow Changing & Unlinking Store Owner Email
-- Allows ADMIN to reassign store owner email, fix typos,
-- cancel invites, and unlink partner accounts safely.
-- ============================================================

-- 1. admin_unlink_store_owner: Removes owner from a store, returning it to team-managed
CREATE OR REPLACE FUNCTION public.admin_unlink_store_owner(p_store_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
	v_store_name text;
	v_prev_owner_id uuid;
	v_prev_owner_email text;
BEGIN
	IF auth.uid() IS NOT NULL THEN
		PERFORM require_team(true);
	END IF;

	SELECT name, owner_id INTO v_store_name, v_prev_owner_id
	FROM stores
	WHERE id = p_store_id AND deleted_at IS NULL;

	IF v_store_name IS NULL THEN
		RAISE EXCEPTION 'STORE_NOT_FOUND';
	END IF;

	-- Unlink previous owner's profile if any
	IF v_prev_owner_id IS NOT NULL THEN
		SELECT email INTO v_prev_owner_email FROM profiles WHERE id = v_prev_owner_id;

		UPDATE profiles
		SET partner_store_id = NULL,
		    role = CASE WHEN role = 'PARTNER'::public.user_role THEN 'STUDENT'::public.user_role ELSE role END
		WHERE id = v_prev_owner_id AND partner_store_id = p_store_id;
	END IF;

	-- Clear owner from store
	UPDATE stores
	SET owner_id = NULL, is_partner = false
	WHERE id = p_store_id;

	-- Also clear any pending invites for this store
	DELETE FROM partner_invites WHERE store_id = p_store_id;

	BEGIN
		PERFORM log_admin(
			'PARTNER_UNLINKED',
			'store',
			p_store_id,
			v_store_name,
			jsonb_build_object('prev_owner', v_prev_owner_email)
		);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;
END;
$$;

-- 2. Enhanced admin_invite_partner: allows inviting OR changing owner of an existing store
CREATE OR REPLACE FUNCTION public.admin_invite_partner(p_email text, p_store_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
	v_email text := lower(trim(coalesce(p_email, '')));
	v_store_name text;
	v_prev_owner_id uuid;
	v_prev_owner_email text;
	v_new_user_id uuid;
BEGIN
	IF auth.uid() IS NOT NULL THEN
		PERFORM require_team(true);
	END IF;

	IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
		RAISE EXCEPTION 'BAD_EMAIL';
	END IF;

	SELECT name, owner_id INTO v_store_name, v_prev_owner_id
	FROM stores
	WHERE id = p_store_id AND deleted_at IS NULL;

	IF v_store_name IS NULL THEN
		RAISE EXCEPTION 'STORE_NOT_FOUND';
	END IF;

	-- If this store already had an owner different from the new email, unlink the previous owner
	IF v_prev_owner_id IS NOT NULL THEN
		SELECT email INTO v_prev_owner_email FROM profiles WHERE id = v_prev_owner_id;

		IF lower(trim(coalesce(v_prev_owner_email, ''))) <> v_email THEN
			UPDATE profiles
			SET partner_store_id = NULL,
			    role = CASE WHEN role = 'PARTNER'::public.user_role THEN 'STUDENT'::public.user_role ELSE role END
			WHERE id = v_prev_owner_id AND partner_store_id = p_store_id;

			UPDATE stores SET owner_id = NULL, is_partner = false WHERE id = p_store_id;
		ELSE
			-- Already owned by this email
			RETURN;
		END IF;
	END IF;

	-- Remove any previous pending invites for this store
	DELETE FROM partner_invites WHERE store_id = p_store_id;

	-- Check if the target email already has an account
	SELECT id INTO v_new_user_id FROM profiles WHERE lower(trim(email)) = v_email;

	IF v_new_user_id IS NOT NULL THEN
		-- Link existing account immediately
		UPDATE profiles
		SET role = 'PARTNER'::public.user_role, partner_store_id = p_store_id
		WHERE id = v_new_user_id;

		UPDATE stores
		SET owner_id = v_new_user_id, is_partner = true
		WHERE id = p_store_id;

		DELETE FROM partner_invites WHERE lower(trim(email)) = v_email;

		BEGIN
			PERFORM log_admin(
				'PARTNER_ASSIGNED',
				'store',
				p_store_id,
				v_store_name,
				jsonb_build_object('email', v_email, 'user_id', v_new_user_id, 'prev_owner', v_prev_owner_email)
			);
		EXCEPTION WHEN OTHERS THEN
			NULL;
		END;
	ELSE
		-- User hasn't signed in yet: save invite so handle_new_user picks it up
		INSERT INTO partner_invites (email, store_id)
		VALUES (v_email, p_store_id)
		ON CONFLICT (email) DO UPDATE SET store_id = excluded.store_id, created_at = now();

		BEGIN
			PERFORM log_admin(
				'PARTNER_INVITED',
				'store',
				p_store_id,
				v_store_name,
				jsonb_build_object('email', v_email, 'prev_owner', v_prev_owner_email)
			);
		EXCEPTION WHEN OTHERS THEN
			NULL;
		END;
	END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_unlink_store_owner(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_invite_partner(text, text) TO authenticated;
