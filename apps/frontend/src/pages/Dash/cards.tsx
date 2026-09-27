export function OrgCard(name: string, description: string) {
  return (
    <div>
      <div>{name}</div>
      <div>{description}</div>
    </div>
  );
}
export function InviteCard(name: string, role: string) {
  return (
    <div>
      <div>{name}</div>
      <div>{role}</div>
    </div>
  );
}
