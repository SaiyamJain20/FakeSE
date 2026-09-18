import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

type Transaction = {
  id: string;
  userId: string;
  username: string;
  ticker: string;
  side: "BUY" | "SELL";
  quantity: number;
  filledPrice: number | null;
  totalValue: number | null;
  createdAt: string;
  executedAt: string | null;
  status: "pending" | "filled" | "cancelled";
};

type TransactionResponse = {
  transactions: Transaction[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

type Props = {
  competitionId: string;
};

export function CompetitionTransactionHistory({ competitionId }: Props) {
  const [offset, setOffset] = useState(0);
  const limit = 10; // 10 transactions per page

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["comp-transactions", competitionId, offset],
    queryFn: () =>
      apiFetch<TransactionResponse>(
        `/competitions/${competitionId}/transactions?limit=${limit}&offset=${offset}`
      ),
    staleTime: 5000,
    refetchInterval: 10000, // Refetch every 10 seconds for fresh data
  });

  const transactions = data?.transactions ?? [];
  const pagination = data?.pagination ?? { limit, offset, total: 0, hasMore: false };

  const handlePrevPage = () => {
    if (offset >= limit) {
      setOffset(offset - limit);
    }
  };

  const handleNextPage = () => {
    if (pagination.hasMore) {
      setOffset(offset + limit);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="card" style={{ marginTop: "2rem", borderTop: "2px solid var(--outline-variant)", paddingTop: "2rem" }}>
      <h3 className="title-sm" style={{ marginBottom: "1.5rem" }}>📊 All Competition Transactions</h3>

      {isLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="spinner" />
          <span className="muted">Loading transactions…</span>
        </div>
      )}

      {isError && (
        <p className="muted" style={{ color: "var(--error-color)" }}>
          Failed to load transactions: {(error as Error).message}
        </p>
      )}

      {!isLoading && !transactions.length && (
        <p className="muted">No transactions yet in this competition.</p>
      )}

      {!!transactions.length && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ fontSize: "0.9rem" }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Ticker</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total Value</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontWeight: 500 }}>{tx.username}</td>
                    <td style={{ fontWeight: 600, color: "var(--primary)" }}>
                      {tx.ticker}
                    </td>
                    <td
                      style={{
                        fontWeight: 600,
                        color: tx.side === "BUY" ? "var(--color-success)" : "var(--color-error)",
                      }}
                    >
                      {tx.side}
                    </td>
                    <td>{tx.quantity}</td>
                    <td>
                      {tx.filledPrice
                        ? `$${tx.filledPrice.toFixed(2)}`
                        : "—"}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {tx.totalValue
                        ? `$${tx.totalValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "—"}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.75rem",
                          borderRadius: "12px",
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          backgroundColor:
                            tx.status === "filled"
                              ? "var(--color-success)"
                              : tx.status === "pending"
                              ? "var(--color-warning)"
                              : "var(--color-error)",
                          color: "white",
                        }}
                      >
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>
                      {formatDate(tx.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "var(--color-surface-mixed)",
              borderRadius: "8px",
            }}
          >
            <div style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>
              Showing {offset + 1} - {Math.min(offset + limit, pagination.total)} of{" "}
              <strong>{pagination.total}</strong> transactions
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className="btn"
                onClick={handlePrevPage}
                disabled={offset === 0}
                style={{
                  opacity: offset === 0 ? 0.5 : 1,
                  cursor: offset === 0 ? "not-allowed" : "pointer",
                }}
              >
                ← Previous
              </button>

              <div style={{ display: "flex", alignItems: "center", padding: "0 0.5rem" }}>
                <span style={{ color: "var(--text-2)", fontSize: "0.85rem" }}>
                  Page {Math.floor(offset / limit) + 1} of{" "}
                  {Math.ceil(pagination.total / limit) || 1}
                </span>
              </div>

              <button
                className="btn"
                onClick={handleNextPage}
                disabled={!pagination.hasMore}
                style={{
                  opacity: !pagination.hasMore ? 0.5 : 1,
                  cursor: !pagination.hasMore ? "not-allowed" : "pointer",
                }}
              >
                Next →
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1rem",
              marginTop: "1.5rem",
            }}
          >
            <div
              style={{
                padding: "1rem",
                backgroundColor: "var(--color-surface-mixed)",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>
                Total Transactions
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginTop: "0.5rem" }}>
                {pagination.total}
              </div>
            </div>
            <div
              style={{
                padding: "1rem",
                backgroundColor: "var(--color-surface-mixed)",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>
                Buy Orders
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  marginTop: "0.5rem",
                  color: "var(--color-success)",
                }}
              >
                {transactions.filter((tx) => tx.side === "BUY").length}
              </div>
            </div>
            <div
              style={{
                padding: "1rem",
                backgroundColor: "var(--color-surface-mixed)",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>
                Sell Orders
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  marginTop: "0.5rem",
                  color: "var(--color-error)",
                }}
              >
                {transactions.filter((tx) => tx.side === "SELL").length}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
