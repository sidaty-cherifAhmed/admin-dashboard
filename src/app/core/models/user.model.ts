export interface User {
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
  roleId: number;
  roleName: string;
}

export interface UserPayload {
  fullName: string;
  phone: string;
  isActive: boolean;
  email: string;
  roleId: number;
  password?: string;
}
