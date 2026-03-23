export interface TeamMember {
  teamMemberId: number;
  userId: number;
  teamId: number;
  fullName?: string;
  email?: string;
  teamName?: string;
}

export interface TeamMemberPayload {
  userId: number;
  teamId: number;
}
