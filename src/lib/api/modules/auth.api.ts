import { apiClient } from '../client';
import { UserSession } from '@/store/auth.store';

export interface LoginInput {
  email?: string;
  password?: string;
  phone?: string;
  otp?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: UserSession;
    permissions: string[];
  };
}

export const authApi = {
  /**
   * Performs credential or phone-based cashier login.
   */
  login: async (input: LoginInput): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', input);
    return response.data;
  },

  /**
   * Registers a team member.
   */
  register: async (input: RegisterInput): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', input);
    return response.data;
  },

  /**
   * Retrieves active profile session metadata.
   */
  getProfile: async (): Promise<{ success: boolean; data: UserSession }> => {
    const response = await apiClient.get<{ success: boolean; data: UserSession }>('/auth/profile');
    return response.data;
  },
};
export default authApi;
