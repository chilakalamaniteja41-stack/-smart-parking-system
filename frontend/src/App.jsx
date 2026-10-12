
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:3000/api";

export default function App() {
  const [slots, setSlots] = useState([]);
  const [history, setHistory] = useState([]);
  const [vehicles, setVehicles] = useState({});
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadSlots() {
    try {
      const res = await fetch(`${API}/slots`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load slots");

      setSlots(Array.isArray(data) ? data : data.slots || []);
      setError("");
    } catch (e) {
      setError(e.message || "Cannot connect to backend");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await fetch(`${API}/history?t=${Date.now()}`, {
        cache: "no-store"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load history");

      setHistory(Array.isArray(data) ? data : data.history || []);
      setHistoryError("");
    } catch (e) {
      setHistoryError(e.message || "Could not load history");
    }
  }

  async function refresh() {
    await Promise.all([loadSlots(), loadHistory()]);
  }

  useEffect(() => {
    refresh();
  }, []);

  function getId(slot) {
    return slot.id ?? slot.slotId ?? slot.slot_id;
  }

  function getName(slot, index) {
    return slot.slotNumber ?? slot.slot_name ?? slot.name ??
      slot.slotId ?? slot.slot_id ?? slot.id ??
      `P${String(index + 1).padStart(2, "0")}`;
  }

  function occupied(slot) {
    return String(slot.status || "").toLowerCase() === "occupied";
  }

  function vehicle(slot) {
    return slot.vehicleNumber ?? slot.vehicle_number ?? slot.vehicle_no ?? "";
  }

  async function updateSlot(slot, status, vehicleNumber = null) {
    setBusy(true);
    setNotice("");

    try {
      const res = await fetch(`${API}/slots/${getId(slot)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status,
          vehicleNumber,
          vehicle_number: vehicleNumber
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to update slot");
      }

      setNotice(
        status === "Occupied"
          ? "Vehicle parked successfully!"
          : "Parking slot released!"
      );

      setVehicles({});
      await refresh();
    } catch (e) {
      setNotice(e.message || "Unable to update parking slot");
    } finally {
      setBusy(false);
    }
  }

  async function resetParking() {
    if (!window.confirm("Reset all parking slots?")) return;

    setBusy(true);

    try {
      const res = await fetch(`${API}/reset`, {
        method: "POST"
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Reset failed");
      }

      setNotice("Parking slots reset successfully!");
      await refresh();
    } catch (e) {
      setNotice(e.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  const occupiedCount = slots.filter(occupied).length;
  const availableCount = slots.length - occupiedCount;

  function date(value) {
    if (!value) return "—";

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
      ? String(value)
      : parsed.toLocaleString();
  }

  return (
    <main className="parking-app">
      <header className="page-header">
        <span className="eyebrow">SMART PARKING SYSTEM</span>
        <h1>Smart Parking Management</h1>
        <p>Find your space. Park with ease.</p>

        <button
          className="refresh-button"
          onClick={refresh}
          disabled={busy}
        >
          ↻ Refresh Slots
        </button>

        <button
          className="reset-button"
          onClick={resetParking}
          disabled={busy}
        >
          ↻ Reset Parking Slots
        </button>
      </header>

      <section className="summary">
        <article className="summary-card total-card">
          <span>Total Slots</span>
          <strong>{slots.length}</strong>
        </article>

        <article className="summary-card available-card">
          <span>Available</span>
          <strong>{availableCount}</strong>
        </article>

        <article className="summary-card occupied-card">
          <span>Occupied</span>
          <strong>{occupiedCount}</strong>
        </article>
      </section>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {loading && <p className="notice">Loading parking slots...</p>}

      <section className="parking-section">
        <div className="section-heading">
          <div>
            <h2>Parking Overview</h2>
            <p>Select an available slot to park your vehicle.</p>
          </div>

          <div className="legend">
            <span><i className="dot green-dot" /> Available</span>
            <span><i className="dot red-dot" /> Occupied</span>
          </div>
        </div>

        {!loading && !error && slots.length === 0 && (
          <p className="notice">No parking slots found.</p>
        )}

        <div className="slot-grid">
          {slots.map((slot, index) => {
            const isFull = occupied(slot);
            const id = getId(slot);

            return (
              <article
                key={id ?? index}
                className={`slot-card ${
                  isFull ? "is-occupied" : "is-available"
                }`}
              >
                <div className="slot-top">
                  <span className="parking-icon">P</span>

                  <span
                    className={`status-pill ${
                      isFull ? "pill-red" : "pill-green"
                    }`}
                  >
                    {isFull ? "Occupied" : "Available"}
                  </span>
                </div>

                <h3>{getName(slot, index)}</h3>
                <p className="slot-label">PARKING SPACE</p>

                {isFull && (
                  <div className="vehicle-info">
                    <span>Vehicle Number</span>
                    <strong>{vehicle(slot) || "Not provided"}</strong>
                  </div>
                )}

                <div className="slot-actions">
                  {!isFull ? (
                    <>
                      <input
                        type="text"
                        placeholder="Enter vehicle number"
                        aria-label={`Vehicle number for ${getName(slot, index)}`}
                        autoComplete="off"
                        value={vehicles[id] ?? ""}
                        onChange={(e) => {
                          setVehicles((old) => ({
                            ...old,
                            [id]: e.target.value
                          }));
                        }}
                      />

                      <button
                        className="occupy-button"
                        disabled={busy}
                        onClick={() => {
                          const number = (vehicles[id] ?? "")
                            .trim()
                            .toUpperCase();

                          if (!number) {
                            setNotice("Please enter a vehicle number.");
                            return;
                          }

                          updateSlot(slot, "Occupied", number);
                        }}
                      >
                        {busy ? "Please wait..." : "Park Vehicle"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="release-button"
                      disabled={busy}
                      onClick={() => updateSlot(slot, "Available")}
                    >
                      Release Slot
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <section className="history-section">
          <h2>Parking History</h2>

          {historyError && <p className="error">{historyError}</p>}

          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Vehicle Number</th>
                  <th>Entry Time</th>
                  <th>Exit Time</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {history.map((item, index) => {
                  const exit = item.exitTime ?? item.exit_time;

                  return (
                    <tr key={item.id ?? index}>
                      <td>
                        {item.slotId ?? item.slot_id ?? item.slotNumber ?? "—"}
                      </td>
                      <td>
                        {item.vehicleNumber ?? item.vehicle_number ?? "—"}
                      </td>
                      <td>{date(item.entryTime ?? item.entry_time)}</td>
                      <td>{date(exit)}</td>
                      <td>
                        <span
                          className={`history-status ${
                            exit ? "history-complete" : "history-active"
                          }`}
                        >
                          {exit ? "Completed" : "Active"}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {history.length === 0 && !historyError && (
                  <tr>
                    <td colSpan="5">No parking history available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <footer>Smart Parking Management System</footer>
    </main>
  );
}
