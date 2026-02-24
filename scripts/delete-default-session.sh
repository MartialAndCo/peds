#!/bin/bash
curl -X POST http://localhost:3000/api/sessions/stop \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"default"}'

echo ""
curl -X POST http://localhost:3000/api/sessions/delete \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"default"}'
echo ""
