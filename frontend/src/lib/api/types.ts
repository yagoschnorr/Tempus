// Este arquivo é gerado por `npm run gen:api` (openapi-typescript) a partir de
// http://localhost:8000/openapi.json. Não editar manualmente após o backend subir.
//
// Stubs temporários para destravar o frontend antes do contrato OpenAPI ficar pronto.

export type UUID = string;

export interface User {
  id: UUID;
  name: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
}

export interface Subject {
  id: UUID;
  name: string;
  color: string | null;
  description: string | null;
  weekly_goal_minutes: number | null;
  created_at: string;
}
