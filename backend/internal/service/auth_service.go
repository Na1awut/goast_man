package service

import (
	"context"
	"errors"
	"os"
	"regexp"
	"time"

	"kmutt-delivery-backend/internal/domain"
	"kmutt-delivery-backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/api/idtoken"
)

type AuthService interface {
	LoginWithGoogle(ctx context.Context, idTokenString string) (string, *domain.User, error)
}

type authService struct {
	userRepo  repository.UserRepository
	jwtSecret []byte
	clientID  string
}

func NewAuthService(userRepo repository.UserRepository) AuthService {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default_secret_key"
	}
	return &authService{
		userRepo:  userRepo,
		jwtSecret: []byte(secret),
		clientID:  os.Getenv("GOOGLE_CLIENT_ID"),
	}
}

func (s *authService) LoginWithGoogle(ctx context.Context, idTokenString string) (string, *domain.User, error) {
	// 1. ตรวจสอบ Google ID Token
	payload, err := idtoken.Validate(ctx, idTokenString, s.clientID)
	if err != nil {
		return "", nil, errors.New("Google Token ไม่ถูกต้อง: " + err.Error())
	}

	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	picture, _ := payload.Claims["picture"].(string)

	// 2. ตรวจสอบเงื่อนไขโดเมน มจธ.
	if err := domain.ValidateKMUTTEmail(email); err != nil {
		return "", nil, err
	}

	studentID := extractStudentID(email)

	// 3. ค้นหาหรือสร้างผู้ใช้ใหม่ (Upsert)
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return "", nil, err
	}

	if user == nil {
		user = &domain.User{
			Email:     email,
			FullName:  name,
			AvatarURL: picture,
			StudentID: studentID,
			Role:      domain.RoleStudent,
			Status:    domain.StatusActive,
		}
		if err := s.userRepo.Create(user); err != nil {
			return "", nil, err
		}
	}

	// 4. ออก JWT ประจำแอป
	claims := jwt.MapClaims{
		"sub":   user.ID.String(),
		"email": user.Email,
		"role":  string(user.Role),
		"exp":   time.Now().Add(time.Hour * 72).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", nil, err
	}

	return tokenString, user, nil
}

func extractStudentID(email string) string {
	re := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@`)
	localPart := re.FindString(email)
	digitRegex := regexp.MustCompile(`\d{10,11}`)
	return digitRegex.FindString(localPart)
}
