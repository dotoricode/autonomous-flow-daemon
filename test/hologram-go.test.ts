import { describe, test, expect } from "bun:test";
import { generateHologram } from "../src/core/hologram";

describe("Go Hologram Extractor", () => {

  test("GO: package clause is preserved", async () => {
    const source = `package main

import "fmt"

func main() {
  fmt.Println("hello")
}
`;
    const result = await generateHologram("main.go", source);
    expect(result.hologram).toContain("package main");
    expect(result.language).toBe("go");
  });

  test("GO: import statements are preserved", async () => {
    const source = `package server

import (
  "fmt"
  "net/http"
)

func Serve() error {
  return http.ListenAndServe(":8080", nil)
}
`;
    const result = await generateHologram("server.go", source);
    expect(result.hologram).toContain(`import (`);
    expect(result.hologram).toContain(`"fmt"`);
    expect(result.hologram).toContain(`"net/http"`);
  });

  test("GO: function body is stubbed", async () => {
    const source = `package main

func Add(a int, b int) int {
  return a + b
}
`;
    const result = await generateHologram("math.go", source);
    expect(result.hologram).toContain("func Add");
    expect(result.hologram).toContain("{…}");
    expect(result.hologram).not.toContain("return a + b");
  });

  test("GO: method with receiver is stubbed", async () => {
    const source = `package store

type Store struct {
  db *DB
}

func (s *Store) GetUser(id string) (*User, error) {
  row := s.db.QueryRow("SELECT * FROM users WHERE id = ?", id)
  return scanUser(row)
}
`;
    const result = await generateHologram("store.go", source);
    expect(result.hologram).toContain("func (s *Store) GetUser");
    expect(result.hologram).toContain("{…}");
    expect(result.hologram).not.toContain("QueryRow");
  });

  test("GO: struct type with fields is extracted", async () => {
    const source = `package daemon

type DaemonState struct {
  Running bool
  Pid     int
  Port    int
  Version string
}
`;
    const result = await generateHologram("state.go", source);
    expect(result.hologram).toContain("type DaemonState struct");
    expect(result.hologram).toContain("Running");
    expect(result.hologram).toContain("bool");
    expect(result.hologram).toContain("Pid");
  });

  test("GO: interface type with methods is extracted", async () => {
    const source = `package extractor

type Extractor interface {
  Extract(source string) []string
  Name() string
}
`;
    const result = await generateHologram("extractor.go", source);
    expect(result.hologram).toContain("type Extractor interface");
    expect(result.hologram).toContain("Extract");
    expect(result.hologram).toContain("Name");
  });

  test("GO: type alias is extracted", async () => {
    const source = `package types

type Handler func(w http.ResponseWriter, r *http.Request)
type ErrorCode int
`;
    const result = await generateHologram("types.go", source);
    expect(result.hologram).toContain("type Handler");
    expect(result.hologram).toContain("type ErrorCode");
  });

  test("GO: compression rate is >= 50% for implementation-heavy file", async () => {
    const source = `package service

import (
  "context"
  "database/sql"
)

type UserService struct {
  db *sql.DB
}

func NewUserService(db *sql.DB) *UserService {
  return &UserService{db: db}
}

func (s *UserService) Create(ctx context.Context, name string, email string) (*User, error) {
  result, err := s.db.ExecContext(ctx, "INSERT INTO users (name, email) VALUES (?, ?)", name, email)
  if err != nil {
    return nil, err
  }
  id, err := result.LastInsertId()
  if err != nil {
    return nil, err
  }
  return &User{ID: id, Name: name, Email: email}, nil
}

func (s *UserService) GetByID(ctx context.Context, id int64) (*User, error) {
  row := s.db.QueryRowContext(ctx, "SELECT id, name, email FROM users WHERE id = ?", id)
  var u User
  if err := row.Scan(&u.ID, &u.Name, &u.Email); err != nil {
    return nil, err
  }
  return &u, nil
}

func (s *UserService) Delete(ctx context.Context, id int64) error {
  _, err := s.db.ExecContext(ctx, "DELETE FROM users WHERE id = ?", id)
  return err
}
`;
    const result = await generateHologram("user_service.go", source);
    expect(result.savings).toBeGreaterThanOrEqual(50);
    expect(result.hologram).toContain("func (s *UserService) Create");
    expect(result.hologram).not.toContain("INSERT INTO users");
  });

  test("GO: .go extension routes to go extractor (not L0 fallback)", async () => {
    const source = `package main

func Hello() string {
  return "hello world, this is a long string that would increase token count significantly if not compressed"
}
`;
    const result = await generateHologram("hello.go", source);
    expect(result.language).toBe("go");
    expect(result.hologram).toContain("{…}");
  });
});
