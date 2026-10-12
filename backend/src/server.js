
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.send("Smart Parking Backend is running!");
});

// Get all parking slots
app.get("/api/slots", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, occupied, vehicleNumber
      FROM parking_slots
      ORDER BY CAST(SUBSTRING(id, 2) AS UNSIGNED)
    `);

    res.json(
      rows.map((row) => ({
        id: Number(String(row.id).replace(/^P/i, "")),
        name: row.id,
        status: Number(row.occupied) === 1
          ? "Occupied"
          : "Available",
        vehicleNumber: row.vehicleNumber || null
      }))
    );
  } catch (error) {
    console.error("GET slots error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get parking history
app.get("/api/history", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, slotId, vehicleNumber, entryTime, exitTime
      FROM parking_history
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("GET history error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Park a vehicle or release a parking slot
app.patch("/api/slots/:id", async (req, res) => {
  let connection;

  try {
    const input = String(req.params.id).toUpperCase();
    const match = input.match(/^P?(\d+)$/);

    if (!match) {
      return res.status(400).json({
        error: "Invalid slot ID."
      });
    }

    const slotNumber = Number(match[1]);

    if (slotNumber < 1 || slotNumber > 10) {
      return res.status(400).json({
        error: "Slot number must be between 1 and 10."
      });
    }

    const slotId = "P" + String(slotNumber).padStart(2, "0");

    const rawStatus = String(req.body.status || "")
      .trim()
      .toLowerCase();

    let status;

    if (rawStatus === "occupied") {
      status = "Occupied";
    } else if (rawStatus === "available") {
      status = "Available";
    } else {
      return res.status(400).json({
        error: 'Status must be "Available" or "Occupied".'
      });
    }

    const vehicleNumber = String(
      req.body.vehicleNumber ?? req.body.vehicle_number ?? ""
    ).trim().toUpperCase();

    if (status === "Occupied" && !vehicleNumber) {
      return res.status(400).json({
        error: "Please enter a vehicle number."
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [slots] = await connection.query(
      `SELECT id, occupied, vehicleNumber
       FROM parking_slots
       WHERE id = ?
       FOR UPDATE`,
      [slotId]
    );

    if (slots.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        error: `Slot ${slotId} does not exist in the database.`
      });
    }

    const slot = slots[0];
    const wasOccupied = Number(slot.occupied) === 1;

    if (status === "Occupied") {
      if (wasOccupied) {
        await connection.rollback();

        return res.status(409).json({
          error: `${slotId} is already occupied. Release it first.`
        });
      }

      await connection.query(
        `UPDATE parking_slots
         SET occupied = 1, vehicleNumber = ?
         WHERE id = ?`,
        [vehicleNumber, slotId]
      );

      await connection.query(
        `INSERT INTO parking_history
         (slotId, vehicleNumber, entryTime, exitTime)
         VALUES (?, ?, CURRENT_TIMESTAMP, NULL)`,
        [slotId, vehicleNumber]
      );
    } else {
      if (wasOccupied) {
        await connection.query(
          `UPDATE parking_history
           SET exitTime = CURRENT_TIMESTAMP
           WHERE slotId = ?
             AND exitTime IS NULL
           ORDER BY id DESC
           LIMIT 1`,
          [slotId]
        );
      }

      await connection.query(
        `UPDATE parking_slots
         SET occupied = 0, vehicleNumber = NULL
         WHERE id = ?`,
        [slotId]
      );
    }

    await connection.commit();

    res.json({
      message: `${slotId} updated successfully.`,
      id: slotNumber,
      name: slotId,
      status,
      vehicleNumber: status === "Occupied"
        ? vehicleNumber
        : null
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError.message);
      }
    }

    console.error("PATCH slot error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Reset all slots and preserve parking history
app.post("/api/reset", async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Close active history records for currently occupied slots.
    await connection.query(`
      UPDATE parking_history h
      INNER JOIN parking_slots s ON h.slotId = s.id
      SET h.exitTime = CURRENT_TIMESTAMP
      WHERE s.occupied = 1
        AND h.exitTime IS NULL
    `);

    // Make every slot available and clear its current vehicle.
    await connection.query(`
      UPDATE parking_slots
      SET occupied = 0,
          vehicleNumber = NULL
    `);

    await connection.commit();

    res.json({
      message: "All parking slots are available. Parking history was preserved."
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError.message);
      }
    }

    console.error("Reset error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Start backend server
app.listen(PORT, () => {
  console.log(
    `Smart Parking Backend running at http://localhost:${PORT}`
  );
});
