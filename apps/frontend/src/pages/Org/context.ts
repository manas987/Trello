import { useOutletContext } from "react-router-dom";
import type { Board, Member, Org, Role } from "../../lib/api";

export type OrgContext = {
  org: Org;
  role: Role;
  isAdmin: boolean;
  boards: Board[];
  reloadBoards: () => void;
  members: Member[];
  reloadMembers: () => void;
};

export const useOrg = () => useOutletContext<OrgContext>();
