import { apiClient } from '../client';

export interface LoginInput {
  email?: string;
  password?: string;
  phone?: string;
  otp?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  shopName: string;
}

/** User shape returned by the backend auth endpoints. */
export interface AuthUser {
  id: string;
  shopId: string;
  email: string;
  name: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: AuthUser;
    tokens: AuthTokens;
  };
}

export const authApi = {
  /**
   * Email + password login. The backend resolves the tenant (shop) from the
   * user account, so no shopId needs to be supplied from the client.
   */
  login: async (input: LoginInput): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', {
      email: input.email,
      password: input.password,
    });
    return response.data;
  },

  register: async (input: RegisterInput): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', input);
    return response.data;
  },

  /** Current authenticated user profile. */
  getMe: async (): Promise<{ success: boolean; data: AuthUser }> => {
    const response = await apiClient.get<{ success: boolean; data: AuthUser }>('/auth/me');
    return response.data;
  },

  /** Server-side session revocation. Best-effort; ignore network failures. */
  logout: async (refreshToken?: string): Promise<void> => {
    await apiClient.post('/auth/logout', refreshToken ? { refreshToken } : {});
  },
};
export default authApi;
