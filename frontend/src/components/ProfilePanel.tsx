type User = {
  id: string;
  username: string;
  email: string;
  role: "user" | "educator" | "admin";
  virtualBalance: string;
};

type Props = {
  user: User;
  portfolioValue?: number;
  holdingsCount?: number;
  onLogout?: () => void;
};

export function ProfilePanel({ user, portfolioValue = 0, holdingsCount = 0, onLogout }: Props) {
  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h2 className="headline-sm">Profile</h2>
          <span className="badge badge-filled">{user.role}</span>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-cell">
          <span>User Name</span>
          <strong>{user.username}</strong>
        </div>
        <div className="stat-cell">
          <span>Email</span>
          <strong>{user.email}</strong>
        </div>
        <div className="stat-cell">
          <span>Account ID</span>
          <strong>{user.id.slice(0, 8)}…</strong>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-cell">
          <span>Portfolio Value</span>
          <strong>₹{portfolioValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
        <div className="stat-cell">
          <span>Virtual Balance</span>
          <strong>₹{Number(user.virtualBalance).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
        <div className="stat-cell">
          <span>Active Holdings</span>
          <strong>{holdingsCount}</strong>
        </div>
      </div>
    </div>
  );
}
