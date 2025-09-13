package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"

	"golang.org/x/crypto/hkdf" // <-- correct import
)

type encReq struct {
	UserID    string `json:"userId"`
	Plaintext string `json:"plaintext"` // base64
}
type encResp struct {
	IV         string `json:"iv"`         // base64
	Tag        string `json:"tag"`        // base64
	Ciphertext string `json:"ciphertext"` // base64
}
type decReq struct {
	UserID     string `json:"userId"`
	IV         string `json:"iv"`         // base64
	Tag        string `json:"tag"`        // base64
	Ciphertext string `json:"ciphertext"` // base64
}
type decResp struct {
	Plaintext string `json:"plaintext"` // base64
}

var master []byte

func mustB64(s string) []byte {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		panic(err)
	}
	return b
}

func deriveKey(userID string) ([]byte, error) {
	if len(master) == 0 {
		return nil, errors.New("master key not set")
	}
	salt := sha256.Sum256([]byte("agent:" + userID))
	r := hkdf.New(sha256.New, master, salt[:], []byte("aes-256-gcm"))
	key := make([]byte, 32)
	if _, err := io.ReadFull(r, key); err != nil {
		return nil, err
	}
	return key, nil
}

func postEncrypt(w http.ResponseWriter, r *http.Request) {
	var req encReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	key, err := deriveKey(req.UserID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	pt := mustB64(req.Plaintext)
	iv := make([]byte, 12)
	if _, err := rand.Read(iv); err != nil {
		http.Error(w, "iv gen", 500)
		return
	}

	block, _ := aes.NewCipher(key)
	aead, _ := cipher.NewGCM(block)
	ct := aead.Seal(nil, iv, pt, nil) // ct = payload|tag
	tag := ct[len(ct)-16:]

	resp := encResp{
		IV:         base64.StdEncoding.EncodeToString(iv),
		Tag:        base64.StdEncoding.EncodeToString(tag),
		Ciphertext: base64.StdEncoding.EncodeToString(ct[:len(ct)-16]),
	}
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func postDecrypt(w http.ResponseWriter, r *http.Request) {
	var req decReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	key, err := deriveKey(req.UserID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	iv := mustB64(req.IV)
	tag := mustB64(req.Tag)
	ct := mustB64(req.Ciphertext)
	ct = append(ct, tag...) // reconstruct ct|tag

	block, _ := aes.NewCipher(key)
	aead, _ := cipher.NewGCM(block)
	pt, err := aead.Open(nil, iv, ct, nil)
	if err != nil {
		http.Error(w, "auth fail", 400)
		return
	}
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(decResp{Plaintext: base64.StdEncoding.EncodeToString(pt)})
}

func main() {
	mk := os.Getenv("MASTER_KEY") // base64-encoded 32 bytes
	if mk == "" {
		log.Fatal("MASTER_KEY env is empty (set it with `oasis rofl secret set MASTER_KEY - < mk.b64`)")
	}
	var err error
	master, err = base64.StdEncoding.DecodeString(mk)
	if err != nil || len(master) != 32 {
		log.Fatal("MASTER_KEY must be base64 for a 32-byte key")
	}

	http.HandleFunc("/encrypt", postEncrypt)
	http.HandleFunc("/decrypt", postDecrypt)
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte(`{"ok":true}`)) })
	log.Println("sidecar listening on :8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}

