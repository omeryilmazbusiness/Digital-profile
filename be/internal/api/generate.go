// Package api contains the HTTP contract generated from be/api/openapi.yaml.
// Do not edit api.gen.go by hand; run `make generate` instead.
package api

//go:generate go tool -modfile=../../tools/go.mod oapi-codegen -config oapi-codegen.yaml ../../api/openapi.yaml
