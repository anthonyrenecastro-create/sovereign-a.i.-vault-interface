import { useState } from "react";
import {
  createAuthUser,
  listAuthUsers,
  login,
  resetAuthUserPassword,
  runAdminShell,
  updateAuthUser,
  verifyAdmin,
  type AuthUser,
  type AuthUserRecord,
} from "../lib/api";

export default function AdminPanel() {
  const [mode, setMode] = useState<"bearer" | "legacy">("bearer");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [bearerToken, setBearerToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [verified, setVerified] = useState(false);
  const [command, setCommand] = useState("ollama list");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<AuthUserRecord[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("operator");
  const [userDraftRoles, setUserDraftRoles] = useState<Record<string, string>>({});
  const [passwordResets, setPasswordResets] = useState<Record<string, string>>({});

  const canManageUsers = mode === "bearer" && verified && user?.role === "admin" && !!bearerToken;

  const refreshUsers = async (tokenToUse?: string) => {
    const activeToken = tokenToUse || bearerToken;
    if (!activeToken) {
      return;
    }

    const listed = await listAuthUsers(activeToken);
    setUsers(listed);
    setUserDraftRoles((prev) => {
      const next: Record<string, string> = {};
      for (const item of listed) {
        next[item.username] = prev[item.username] || item.role;
      }
      return next;
    });
  };

  const unlock = async () => {
    setBusy(true);
    try {
      let ok = false;

      if (mode === "bearer") {
        const session = await login(username.trim(), password);
        setBearerToken(session.access_token);
        setUser(session.user);
        ok = await verifyAdmin({ bearerToken: session.access_token });
        if (ok && session.user.role === "admin") {
          await refreshUsers(session.access_token);
        }
      } else {
        ok = await verifyAdmin({ legacyToken: token });
        if (ok) {
          setUser({ username: "legacy-token", role: "admin" });
          setBearerToken("");
          setUsers([]);
        }
      }

      setVerified(ok);
      setOutput(ok ? "Operator mode unlocked." : "Authentication failed.");
    } catch (error) {
      setVerified(false);
      setBearerToken("");
      setUser(null);
      setOutput(error instanceof Error ? error.message : "Unable to verify credentials.");
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    setVerified(false);
    setBearerToken("");
    setUser(null);
    setPassword("");
    setUsers([]);
    setOutput("Logged out.");
  };

  const createUser = async () => {
    if (!canManageUsers) {
      setOutput("Admin bearer session required to manage users.");
      return;
    }

    if (!newUsername.trim() || !newPassword) {
      setOutput("Provide username and password for the new user.");
      return;
    }

    setBusy(true);
    try {
      await createAuthUser({
        bearerToken,
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      });
      await refreshUsers();
      setNewUsername("");
      setNewPassword("");
      setOutput("User created successfully.");
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Failed to create user.");
    } finally {
      setBusy(false);
    }
  };

  const saveRole = async (target: AuthUserRecord) => {
    if (!canManageUsers) {
      return;
    }

    const roleToSet = userDraftRoles[target.username] || target.role;
    setBusy(true);
    try {
      await updateAuthUser({
        bearerToken,
        username: target.username,
        role: roleToSet,
      });
      await refreshUsers();
      setOutput(`Updated role for ${target.username} to ${roleToSet}.`);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Failed to update role.");
    } finally {
      setBusy(false);
    }
  };

  const toggleDisabled = async (target: AuthUserRecord) => {
    if (!canManageUsers) {
      return;
    }

    setBusy(true);
    try {
      await updateAuthUser({
        bearerToken,
        username: target.username,
        disabled: !target.disabled,
      });
      await refreshUsers();
      setOutput(`${target.username} is now ${target.disabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Failed to update account status.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (target: AuthUserRecord) => {
    if (!canManageUsers) {
      return;
    }

    const candidate = passwordResets[target.username] || "";
    if (candidate.length < 8) {
      setOutput("Reset password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      await resetAuthUserPassword({
        bearerToken,
        username: target.username,
        password: candidate,
      });
      setPasswordResets((prev) => ({ ...prev, [target.username]: "" }));
      setOutput(`Password reset for ${target.username}.`);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!verified) {
      setOutput("Unlock admin mode first.");
      return;
    }

    setBusy(true);
    try {
      const result = await runAdminShell({
        command,
        bearerToken: mode === "bearer" ? bearerToken : undefined,
        legacyToken: mode === "legacy" ? token : undefined,
      });
      const text = [
        `Exit code: ${result.exit_code}`,
        "",
        "STDOUT:",
        result.stdout || "(none)",
        "",
        "STDERR:",
        result.stderr || "(none)",
      ].join("\n");
      setOutput(text);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Command failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-shell">
      <header className="panel-header">
        <h2>Operator Console (PowerCoder-Z)</h2>
      </header>

      <div className="admin-controls">
        <select
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as "bearer" | "legacy");
            setVerified(false);
            setBearerToken("");
            setUser(null);
          }}
        >
          <option value="bearer">Bearer login (RBAC)</option>
          <option value="legacy">Legacy admin token</option>
        </select>
      </div>

      {mode === "bearer" ? (
        <>
          <div className="admin-controls">
            <input
              placeholder="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={unlock}
              disabled={busy || !username.trim() || !password}
            >
              Login + Unlock
            </button>
          </div>
        </>
      ) : (
        <div className="admin-controls">
          <input
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <button type="button" onClick={unlock} disabled={busy || !token.trim()}>
            Unlock
          </button>
        </div>
      )}

      {user && <p className="status-text">Session: {user.username} ({user.role})</p>}

      <div className="admin-controls">
        <button type="button" onClick={logout} disabled={busy || !verified}>
          Logout
        </button>
      </div>

      <div className="admin-controls">
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Local command"
        />
        <button type="button" onClick={run} disabled={busy || !verified || !command.trim()}>
          Run
        </button>
      </div>

      <pre className="terminal-output">{output || "No command executed yet."}</pre>

      <div className="admin-user-shell">
        <h3>Access Management</h3>
        {canManageUsers ? (
          <>
            <div className="admin-controls">
              <button type="button" onClick={() => refreshUsers()} disabled={busy}>
                Refresh Users
              </button>
            </div>

            <div className="admin-controls">
              <input
                placeholder="New username"
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <select value={newRole} onChange={(event) => setNewRole(event.target.value)}>
                <option value="viewer">viewer</option>
                <option value="analyst">analyst</option>
                <option value="operator">operator</option>
                <option value="admin">admin</option>
              </select>
              <button
                type="button"
                onClick={createUser}
                disabled={busy || !newUsername.trim() || !newPassword}
              >
                Create User
              </button>
            </div>

            <div className="users-list">
              {users.length === 0 ? (
                <p className="status-text">No users returned yet.</p>
              ) : (
                users.map((item) => (
                  <article key={item.username} className="user-card">
                    <strong>{item.username}</strong>
                    <p>Role: {item.role}</p>
                    <p>Status: {item.disabled ? "disabled" : "active"}</p>
                    <p>Created: {item.created_at || "n/a"}</p>

                    <div className="user-actions">
                      <select
                        value={userDraftRoles[item.username] || item.role}
                        onChange={(event) =>
                          setUserDraftRoles((prev) => ({
                            ...prev,
                            [item.username]: event.target.value,
                          }))
                        }
                        disabled={busy}
                      >
                        <option value="viewer">viewer</option>
                        <option value="analyst">analyst</option>
                        <option value="operator">operator</option>
                        <option value="admin">admin</option>
                      </select>
                      <button type="button" onClick={() => saveRole(item)} disabled={busy}>
                        Save Role
                      </button>
                      <button type="button" onClick={() => toggleDisabled(item)} disabled={busy}>
                        {item.disabled ? "Enable" : "Disable"}
                      </button>
                    </div>

                    <div className="user-actions">
                      <input
                        type="password"
                        placeholder="New password"
                        value={passwordResets[item.username] || ""}
                        onChange={(event) =>
                          setPasswordResets((prev) => ({
                            ...prev,
                            [item.username]: event.target.value,
                          }))
                        }
                      />
                      <button type="button" onClick={() => resetPassword(item)} disabled={busy}>
                        Reset Password
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        ) : (
          <p className="status-text">
            User management requires bearer mode with an authenticated admin account.
          </p>
        )}
      </div>
    </section>
  );
}
