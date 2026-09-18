import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import { OrderForm } from "./OrderForm";
import { CompetitionTransactionHistory } from "./CompetitionTransactionHistory";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMarketStore } from "../store/marketStore";

type LeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  portfolioValue: number;
};

type LeaderboardData = {
  leaderboard: LeaderboardRow[];
  startAt: string;
  endAt: string;
};

type Competition = {
  id: string;
  name:string;
  startBalance: string;
  startAt: string;
  endAt: string;
  isPublic: boolean;
  createdBy: string;
  creatorUsername?: string;
  joinCode: string;
};

type MiniLeaderboardEntry = {
  rank: number;
  username: string;
  portfolioValue: string;
  isCurrentUser: boolean;
};

type JoinedCompetition = Competition & {
  participantCount: number;
  userRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
};

const toDateTimeLocal = (date: Date) => {
  const ten = (i: number) => (i < 10 ? '0' : '') + i;
  const YYYY = date.getFullYear();
  const MM = ten(date.getMonth() + 1);
  const DD = ten(date.getDate());
  const HH = ten(date.getHours());
  const II = ten(date.getMinutes());
  return `${YYYY}-${MM}-${DD}T${HH}:${II}`;
};


export function CompetitionBoard() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"list" | "create" | "leaderboard" | "hosted" | "edit" | "joined">("list");
  const [activeCompetitionId, setActiveCompetitionId] = useState("");
  const [selectedStock, setSelectedStock] = useState<{ ticker: string, displayTicker: string, price: number, dbTicker?: string } | null>(null);
  const prices = useMarketStore(s => s.prices);

  // Form state
  const [formName, setFormName] = useState("");
  const [formStartBalance, setFormStartBalance] = useState("100000");
  const [formIsPublic, setFormIsPublic] = useState(true);
  const [formPassword, setFormPassword] = useState("");
  const [formStartAt, setFormStartAt] = useState(toDateTimeLocal(new Date()));
  const [formEndAt, setFormEndAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toDateTimeLocal(d);
  });

  const [formDataSource, setFormDataSource] = useState("simulated");
  const [formAllowInfluence, setFormAllowInfluence] = useState(false);
  const [formTickers, setFormTickers] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);

  // Join league state
  const [joinCodeInput, setJoinCodeInput] = useState("");

  const listQuery = useQuery({
    queryKey: ["competitions"],
    queryFn: () => apiFetch<{ competitions: Competition[] }>("/competitions"),
    enabled: view === "list",
    refetchInterval: view === "list" ? 5000 : false,
  });

  const hostedQuery = useQuery({
    queryKey: ["competitions", "hosted"],
    queryFn: () => apiFetch<{ competitions: Competition[] }>("/competitions/hosted"),
    enabled: view === "hosted",
    refetchInterval: view === "hosted" ? 5000 : false,
  });

  const joinedQuery = useQuery({
    queryKey: ["competitions", "joined"],
    queryFn: () => apiFetch<{ competitions: JoinedCompetition[] }>("/competitions/joined"),
    enabled: view === "joined",
    refetchInterval: view === "joined" ? 10000 : false,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", activeCompetitionId],
    queryFn: () =>
      apiFetch<LeaderboardData>(`/competitions/${activeCompetitionId}/leaderboard`),
    enabled: view === "leaderboard" && activeCompetitionId.length > 0,
    refetchInterval: false, // No longer refetches automatically
  });

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", activeCompetitionId],
    queryFn: () =>
      apiFetch<{ stocks: any[] }>(`/competitions/${activeCompetitionId}/dashboard`),
    enabled: view === "leaderboard" && activeCompetitionId.length > 0,
    refetchInterval: view === "leaderboard" ? 5000 : false,
  });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (view === "leaderboard" || view === "joined") {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [view]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiFetch<{ competition: Competition }>("/competitions", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      alert(`League created successfully! Your join code is: ${data.competition.joinCode}`);
      setView("hosted");
    }
  });

  const joinMutation = useMutation({
    mutationFn: (data: { idOrCode: string, password?: string }) => apiFetch<{ ok: boolean, competitionId: string }>(`/competitions/${data.idOrCode}/join`, { 
      method: "POST",
      body: JSON.stringify({ password: data.password })
    }),
    onSuccess: (data, variables) => {
      setActiveCompetitionId(data.competitionId);
      setSelectedStock(null);
      setView("leaderboard");
      setJoinCodeInput("");
    },
    onError: (err: Error, variables) => {
      if (err.message.toLowerCase().includes("password")) {
        const password = window.prompt("This league is private. Please enter the password:");
        if (password) {
          joinMutation.mutate({ ...variables, password });
        }
      } else {
        alert("Failed to join: " + err.message);
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiFetch<{ ok: boolean }>(`/competitions/${activeCompetitionId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions", "hosted"] });
      alert("League updated successfully!");
      setView("hosted");
    }
  });

  const [bulkUsersText, setBulkUsersText] = useState("");
  const uploadUsersMutation = useMutation({
    mutationFn: (usernames: string[]) => apiFetch<{ queued: number, message?: string }>(`/competitions/${activeCompetitionId}/participants-bulk`, {
      method: "POST",
      body: JSON.stringify({ usernames })
    }),
    onSuccess: (data) => {
      alert(`Successfully queued ${data.queued} participants. Refresh later to see them.`);
      setBulkUsersText("");
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const usernames = text.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
      if (usernames.length > 0) {
        uploadUsersMutation.mutate(usernames);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formName,
      isPublic: formIsPublic,
      startAt: new Date(formStartAt).toISOString(),
      endAt: new Date(formEndAt).toISOString(),
      password: formIsPublic ? undefined : formPassword,
    };

    if (view === "edit") {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate({
        ...payload,
        startBalance: Number(formStartBalance),
      });
    }
  };

  const handleEditClick = (comp: Competition) => {
    setActiveCompetitionId(comp.id);
    setFormName(comp.name);
    setFormStartBalance(comp.startBalance);
    // Read isPublic directly from the boolean field the API returns
    setFormIsPublic(comp.isPublic);
    setFormStartAt(toDateTimeLocal(new Date(comp.startAt)));
    setFormEndAt(toDateTimeLocal(new Date(comp.endAt)));
    setSelectedStock(null);
    setView("edit");
  };

  const handleStockConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const config = {
      dataSource: formDataSource,
      allowInfluence: formAllowInfluence,
      tickers: formTickers.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    };

    try {
      if (formDataSource === 'excel') {
        if (!formFile) return alert("Please select an Excel file.");
        const fd = new FormData();
        fd.append('file', formFile);
        fd.append('config', JSON.stringify(config));
        await fetch(`${import.meta.env.VITE_API_URL}/competitions/${activeCompetitionId}/stock-data`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem("token") || ""}` },
          body: fd
        });
        alert("Excel data uploaded successfully.");
      } else {
        await apiFetch<{ ok: boolean }>(`/competitions/${activeCompetitionId}/stock-config`, {
          method: 'PUT',
          body: JSON.stringify(config)
        });
        alert("Stock configuration saved.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 className="title-sm">{
          view === "list" ? "Open Leagues" :
          view === "create" ? "Host Competition" :
          view === "hosted" ? "My Hosted Leagues" :
          view === "joined" ? "Joined Leagues" :
          view === "edit" ? "Edit League" :
          "Leaderboard"
        }</h2>
        <div style={{ display: "flex", gap: "1rem" }}>
          {view === "leaderboard" && activeCompetitionId && (
            <button className="btn" onClick={() => leaderboardQuery.refetch()}>Refresh</button>
          )}
          {view !== "list" && (
            <button className="btn" onClick={() => { setView("list"); setActiveCompetitionId(""); }}>Open Leagues</button>
          )}
          {view !== "joined" && (
            <button className="btn" onClick={() => { setView("joined"); setActiveCompetitionId(""); }}>Joined Leagues</button>
          )}
          {view !== "hosted" && (
            <button className="btn" onClick={() => { setView("hosted"); setActiveCompetitionId(""); }}>My Hosted</button>
          )}
          {view === "list" && (
            <button className="btn-primary" onClick={() => setView("create")}>Host New</button>
          )}
        </div>
      </div>

      {view === "list" && (
        <>
          {listQuery.isLoading ? <p className="muted">Loading open leagues...</p> : null}
          {listQuery.data?.competitions?.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Created By</th>
                  <th>Start Balance</th>
                  <th>Join Code</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.competitions.map((comp) => (
                  <tr key={comp.id}>
                    <td>{comp.name}</td>
                    <td>{comp.createdBy}</td>
                    <td>${Number(comp.startBalance).toLocaleString()}</td>
                    <td><code>{comp.joinCode}</code></td>
                    <td>
                      <button className="btn-sm" onClick={() => joinMutation.mutate({ idOrCode: comp.id })}>Join</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !listQuery.isLoading && <p className="muted">No open leagues available right now.</p>
          )}

          <div style={{ marginTop: "2rem" }}>
            <h3 className="title-sm" style={{ marginBottom: "1rem" }}>Join a League by Code</h3>
            <div className="input-group" style={{ display: "flex", gap: "1rem", maxWidth: "400px" }}>
              <input
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.trim().toUpperCase())}
                placeholder="Enter Join Code"
                style={{ flex: 1, textTransform: "uppercase" }}
              />
              <button className="btn-primary" onClick={() => joinMutation.mutate({ idOrCode: joinCodeInput })} disabled={joinCodeInput.length === 0 || joinMutation.isPending}>
                {joinMutation.isPending ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
        </>
      )}

      {view === "joined" && (
        <JoinedCompetitionList
          query={joinedQuery}
          now={now}
          onViewLeaderboard={(id) => {
            setActiveCompetitionId(id);
            setSelectedStock(null);
            setView("leaderboard");
          }}
        />
      )}

      {view === "hosted" && (
        <>
          {hostedQuery.isLoading ? <p className="muted">Loading your leagues...</p> : null}
          {hostedQuery.data?.competitions?.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Join Code</th>
                  <th>Visibility</th>
                  <th>Start Balance</th>
                  <th>Dates</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hostedQuery.data.competitions.map((comp: any) => (
                  <tr key={comp.id}>
                    <td>{comp.name}</td>
                    <td><code>{comp.joinCode}</code></td>
                    <td><span className={`badge ${comp.isPublic ? 'public' : 'private'}`}>{comp.isPublic ? 'Public' : 'Private'}</span></td>
                    <td>${Number(comp.startBalance).toLocaleString()}</td>
                    <td>{new Date(comp.startAt).toLocaleDateString()} - {new Date(comp.endAt).toLocaleDateString()}</td>
                    <td style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn-sm" onClick={() => handleEditClick(comp)}>Edit</button>
                      <button className="btn-sm" onClick={() => { setActiveCompetitionId(comp.id); setView("leaderboard"); }}>Dashboard</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !hostedQuery.isLoading && <p className="muted">You haven't hosted any leagues yet.</p>
          )}
        </>
      )}

      {view === "create" && (
        <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
          <div className="input-group">
            <label>League Name</label>
            <input required value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Winter Clash" />
          </div>
          <div className="input-group">
            <label>Start Balance ($)</label>
            <input type="number" required value={formStartBalance} onChange={e => setFormStartBalance(e.target.value)} min={1000} />
          </div>
          <div className="input-group" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" id="isPublic" checked={formIsPublic} onChange={e => setFormIsPublic(e.target.checked)} />
            <label htmlFor="isPublic" style={{ cursor: "pointer" }}>Open to all (Public League)</label>
          </div>
          {!formIsPublic && (
            <div className="input-group">
              <label>League Password</label>
              <input type="password" required={!formIsPublic} value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Set a password for private league" />
            </div>
          )}
          <div className="input-group">
            <label>Start Date & Time</label>
            <input type="datetime-local" required value={formStartAt} onChange={e => setFormStartAt(e.target.value)} />
          </div>
          <div className="input-group">
            <label>End Date & Time</label>
            <input type="datetime-local" required value={formEndAt} onChange={e => setFormEndAt(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: "1rem" }} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create League"}
          </button>
        </form>
      )}

      {view === "edit" && (
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", flexDirection: "column" }}>
          
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: "300px", flex: 1 }}>
              <h3 className="title-sm">Edit League Properties</h3>
              <div className="input-group">
                <label>League Name</label>
                <input required value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div className="input-group" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" id="isPublicEdit" checked={formIsPublic} onChange={e => setFormIsPublic(e.target.checked)} />
                <label htmlFor="isPublicEdit" style={{ cursor: "pointer" }}>Public</label>
              </div>
               {!formIsPublic && (
                <div className="input-group">
                  <label>League Password</label>
                  <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Leave blank to keep unchanged" />
                </div>
              )}
              <div className="input-group">
                <label>Start Date & Time</label>
                <input type="datetime-local" required value={formStartAt} onChange={e => setFormStartAt(e.target.value)} />
              </div>
              <div className="input-group">
                <label>End Date & Time</label>
                <input type="datetime-local" required value={formEndAt} onChange={e => setFormEndAt(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: "1rem" }} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </form>

            <div style={{ flex: 1, minWidth: "300px", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 className="title-sm">Add Participants</h3>
              <div className="input-group">
                <label>Usernames (comma or newline separated)</label>
                <textarea 
                  rows={4} 
                  value={bulkUsersText} 
                  onChange={e => setBulkUsersText(e.target.value)} 
                  placeholder="user1, user2&#10;user3" 
                />
                <button 
                  className="btn" 
                  style={{ marginTop: "0.5rem" }} 
                  onClick={() => uploadUsersMutation.mutate(bulkUsersText.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean))}
                  disabled={bulkUsersText.length === 0 || uploadUsersMutation.isPending}
                >
                  {uploadUsersMutation.isPending ? "Adding..." : "Add Users"}
                </button>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <label htmlFor="file-upload" className="btn">
                  Upload from .txt file
                </label>
                <input id="file-upload" type="file" accept=".txt" onChange={handleFileUpload} style={{ display: "none" }}/>
              </div>
            </div>
          </div>

          <form onSubmit={handleStockConfigSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: "300px", maxWidth: "600px", background: "var(--color-surface-mixed)", padding: "1.5rem", borderRadius: "8px" }}>
            <h3 className="title-sm">Competition Market Mode</h3>
            <p className="muted" style={{ fontSize: "0.85rem" }}>Configure what stocks trace this competition.</p>
            <div className="input-group">
              <label>Data Source</label>
              <select className="form-input" value={formDataSource} style={{ padding: "0.5rem" }} onChange={e => setFormDataSource(e.target.value)}>
                <option value="simulated">Simulated (via Market Sim)</option>
                <option value="real">Real-time (via Polygon)</option>
                <option value="excel">From Excel file</option>
              </select>
            </div>
            
            <div className="input-group">
              <label>Tickers (comma separated)</label>
              <input value={formTickers} style={{ padding: "0.5rem" }} onChange={e => setFormTickers(e.target.value)} placeholder="AAPL, TSLA, SPY" />
            </div>

            {formDataSource === "excel" && (
              <div className="input-group">
                <label>Upload .xlsx file</label>
                <input type="file" accept=".xlsx" onChange={e => e.target.files && setFormFile(e.target.files[0])} />
                <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  The file should have columns: Ticker, Time, Open, High, Low, Close, Volume.
                </p>
              </div>
            )}

            <div className="input-group" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" id="allowInfluence" checked={formAllowInfluence} onChange={e => setFormAllowInfluence(e.target.checked)} />
              <label htmlFor="allowInfluence" style={{ cursor: "pointer" }}>Enable Player Influence (trades move price)</label>
            </div>
            
            <button type="submit" className="btn-primary" style={{ marginTop: "1rem", alignSelf: "flex-start", padding: "0.5rem 1.5rem" }}>
              Apply Stock Configuration
            </button>
          </form>

        </div>
      )}

      {view === "leaderboard" && (
        <>
          {leaderboardQuery.isLoading ? <p className="muted">Loading leaderboard...</p> : null}
          {leaderboardQuery.isError && !leaderboardQuery.data ? <p className="muted">{(leaderboardQuery.error as Error).message}</p> : null}

          {/* Show reloading indicator when fetching (but keep showing data) */}
          {leaderboardQuery.isFetching && leaderboardQuery.data && (
            <div style={{ background: "var(--color-warning)", color: "white", padding: "0.5rem 1rem", borderRadius: "4px", marginBottom: "1rem", textAlign: "center", opacity: 0.8 }}>
              ⟳ Reloading changes...
            </div>
          )}

          {leaderboardQuery.data?.startAt && now < new Date(leaderboardQuery.data.startAt).getTime() ? (
            <div style={{ background: "var(--color-surface-mixed)", padding: "2rem", textAlign: "center", borderRadius: "8px", margin: "1rem 0" }}>
              <h3 className="headline-sm" style={{ color: "var(--secondary-neon)" }}>Competition starts in:</h3>
              <p className="title-sm" style={{ marginTop: "0.5rem" }}>
                {Math.ceil((new Date(leaderboardQuery.data.startAt).getTime() - now) / 60000)} minutes
              </p>
            </div>
          ) : leaderboardQuery.data?.startAt ? (
            <div style={{ background: "var(--color-success)", color: "white", padding: "0.5rem 1rem", borderRadius: "4px", marginBottom: "1rem", textAlign: "center" }}>
              Competition has started!
            </div>
          ) : null}

          {leaderboardQuery.data?.leaderboard?.length ? (
            <>
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "300px" }}>
                  <h3 className="title-sm" style={{ marginBottom: "1rem" }}>Leaderboard</h3>
                  <table className="data-table" style={{ opacity: leaderboardQuery.isFetching ? 0.7 : 1 }}>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>User</th>
                        <th>Portfolio Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardQuery.data.leaderboard.map((row) => (
                        <tr key={row.userId}>
                          <td>{row.rank}</td>
                          <td>{row.username}</td>
                          <td>${row.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {selectedStock && (
                    <CompetitionStockChart competitionId={activeCompetitionId} ticker={selectedStock.ticker} displayTicker={selectedStock.displayTicker} />
                  )}
                </div>

                {dashboardQuery.data?.stocks && dashboardQuery.data.stocks.length > 0 && (
                  <div style={{ flex: 1, minWidth: "300px" }}>
                    <h3 className="title-sm" style={{ marginBottom: "1rem" }}>Your Target Stocks</h3>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ticker</th>
                          <th>Price</th>
                          <th>Holdings</th>
                          <th>PnL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardQuery.data.stocks.map((stock: any) => {
                          const livePrice = prices[stock.dbTicker]?.price ?? stock.price;
                          const livePnl = stock.holdingQuantity > 0 && typeof livePrice === 'number' 
                            ? (livePrice - stock.avgCost) * stock.holdingQuantity 
                            : stock.pnl;
                          return (
                          <tr 
                            key={stock.ticker} 
                            onClick={() => setSelectedStock(stock)}
                            style={{ cursor: "pointer", background: selectedStock?.ticker === stock.ticker ? "var(--color-primary-muted)" : "transparent" }}
                          >
                            <td>{stock.displayTicker}</td>
                            <td>{typeof livePrice === 'number' ? `$${livePrice.toFixed(2)}` : '--'}</td>
                            <td>{stock.holdingQuantity || 0}</td>
                            <td>{typeof livePnl === 'number' ? livePnl.toFixed(2) : "0.00"}</td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                    
                    <div style={{ marginTop: "2rem", padding: "1rem", background: "var(--color-surface-mixed)" }}>
                      {selectedStock ? (
                        <OrderForm 
                          key={selectedStock.ticker} // Re-mounts the component when stock changes
                          initialTicker={selectedStock.ticker}
                          competitionId={activeCompetitionId}
                          dbTicker={selectedStock.dbTicker}
                          onOrderPlaced={() => {
                            dashboardQuery.refetch();
                            leaderboardQuery.refetch();
                          }}
                        />
                      ) : (
                        <p className="muted">Select a stock from the table above to place an order.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Competition Transaction History */}
              <div style={{ marginTop: "2rem" }}>
                <CompetitionTransactionHistory competitionId={activeCompetitionId} />
              </div>
            </>
          ) : !leaderboardQuery.isLoading ? (
            <p className="muted">No participants yet.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

function CompetitionStockChart({ competitionId, ticker, displayTicker }: { competitionId: string, ticker: string, displayTicker:string }) {
  const chartQuery = useQuery({
    queryKey: ["competition-history", competitionId, ticker],
    queryFn: () => apiFetch<{ points: { time: string; price: number }[] }>(`/competitions/${competitionId}/stock-history/${ticker}`),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const chartData = chartQuery.data?.points.map(p => ({
    time: new Date(p.time).getTime(), // Use timestamp for X-axis
    price: p.price
  })) || [];

  return (
    <div className="card" style={{ marginTop: "1rem", border: "1px solid var(--outline-variant)" }}>
      <h3 className="title-sm" style={{ marginBottom: "1rem" }}>{displayTicker} Historical Chart</h3>
      <div style={{ height: "300px" }}>
        {chartQuery.isLoading ? <p className="muted">Loading chart data...</p> : chartQuery.isError ? <p className="muted" color="var(--error-color)">Error fetching history</p> : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <XAxis 
                dataKey="time" 
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                tick={{ fill: "var(--text-3)", fontSize: 12, fontFamily: "var(--font-data)" }} 
                axisLine={false} 
                tickLine={false}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tickFormatter={(val) => `$${val.toFixed(2)}`} 
                tick={{ fill: "var(--text-3)", fontSize: 12, fontFamily: "var(--font-data)" }} 
                axisLine={false} 
                tickLine={false} 
                width={60} 
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} stroke="var(--outline-variant)" />
              <Tooltip
                labelFormatter={(time) => new Date(time).toLocaleString()}
                formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
                contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--outline)", borderRadius: "0.5rem" }}
              />
              <Area type="monotone" dataKey="price" stroke="var(--secondary-neon)" strokeWidth={2} fillOpacity={0.1} fill="var(--secondary-neon)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <p className="muted">No price history available</p>}
      </div>
    </div>
  );
}


function JoinedCompetitionCard({ comp, now, onViewLeaderboard }: { comp: JoinedCompetition, now: number, onViewLeaderboard: (id: string) => void }) {
  const startMs = new Date(comp.startAt).getTime();
  const endMs = new Date(comp.endAt).getTime();
  const hasStarted = now > startMs;
  const hasEnded = now > endMs;

  let statusText = "";
  let statusColor = "";

  if (hasEnded) {
    statusText = "Ended";
    statusColor = "var(--color-text-muted)";
  } else if (hasStarted) {
    const timeLeft = endMs - now;
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    statusText = `Ends in ${days}d ${hours}h`;
    statusColor = "var(--color-success)";
  } else {
    const timeLeft = startMs - now;
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    statusText = `Starts in ${days}d ${hours}h`;
    statusColor = "var(--color-warning)";
  }

  return (
    <div className="card" style={{ background: "var(--color-surface-mixed)", marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h3 className="title-sm" style={{ marginBottom: "0.25rem" }}>{comp.name}</h3>
          <p className="muted" style={{ fontSize: "0.8rem" }}>{comp.participantCount} participants</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: statusColor, fontWeight: "bold" }}>{statusText}</p>
          {comp.userRank && <p className="muted" style={{ fontSize: "0.8rem" }}>Your Rank: {comp.userRank}</p>}
        </div>
      </div>

      {comp.miniLeaderboard.length > 0 && (
        <table className="data-table" style={{ fontSize: "0.8rem" }}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {comp.miniLeaderboard.map(row => (
              <tr key={row.username} style={{ fontWeight: row.isCurrentUser ? "bold" : "normal", color: row.isCurrentUser ? "var(--primary)" : "inherit" }}>
                <td>{row.rank}</td>
                <td>{row.username}</td>
                <td>{row.portfolioValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button className="btn" style={{ marginTop: "1rem", width: "100%" }} onClick={() => onViewLeaderboard(comp.id)}>
        View Leaderboard
      </button>
    </div>
  );
}

function JoinedCompetitionList({ query, now, onViewLeaderboard }: { query: any, now: number, onViewLeaderboard: (id: string) => void }) {
  if (query.isLoading) return <p className="muted">Loading your joined leagues...</p>;
  if (query.isError) return <p className="muted">Error: {query.error.message}</p>;
  if (!query.data?.competitions?.length) return <p className="muted">You haven't joined any leagues yet.</p>;

  return (
    <div>
      {query.data.competitions.map((comp: JoinedCompetition) => (
        <JoinedCompetitionCard key={comp.id} comp={comp} now={now} onViewLeaderboard={onViewLeaderboard} />
      ))}
    </div>
  );
}
