const API_URL = "http://localhost:3000/api";

const totalSlotsEl = document.getElementById("totalSlots");
const availableSlotsEl = document.getElementById("availableSlots");
const occupiedSlotsEl = document.getElementById("occupiedSlots");
const parkingSlotsEl = document.getElementById("parkingSlots");
const resetBtn = document.getElementById("resetBtn");
const messageEl = document.getElementById("message");

async function loadSlots() {
    try {
        const response = await fetch(API_URL + "/slots");

        if (!response.ok) {
            throw new Error("Failed to load slots");
        }

        const slots = await response.json();

        totalSlotsEl.textContent = slots.length;
        availableSlotsEl.textContent =
            slots.filter(slot => slot.status === "Available").length;
        occupiedSlotsEl.textContent =
            slots.filter(slot => slot.status === "Occupied").length;

        parkingSlotsEl.innerHTML = "";

        slots.forEach(slot => {
            const isOccupied = slot.status === "Occupied";
            const card = document.createElement("div");

            card.className = "slot-card " +
                (isOccupied ? "occupied" : "available");

            const heading = document.createElement("h3");
            heading.textContent = slot.name;

            const status = document.createElement("p");
            status.textContent = slot.status;

            const vehicle = document.createElement("p");
            vehicle.textContent = "Vehicle: " +
                (slot.vehicleNumber || "None");

            const button = document.createElement("button");
            button.textContent = isOccupied ? "Release Slot" : "Park Vehicle";

            button.addEventListener("click", async () => {
                let vehicleNumber = null;
                let newStatus = "Available";

                if (!isOccupied) {
                    vehicleNumber = prompt("Enter vehicle number:");

                    if (vehicleNumber === null) return;

                    vehicleNumber = vehicleNumber.trim();

                    if (!vehicleNumber) {
                        alert("Please enter a vehicle number.");
                        return;
                    }

                    newStatus = "Occupied";
                }

                await updateSlot(slot.name, newStatus, vehicleNumber);
            });

            card.appendChild(heading);
            card.appendChild(status);
            card.appendChild(vehicle);
            card.appendChild(button);

            parkingSlotsEl.appendChild(card);
        });

        if (messageEl) messageEl.textContent = "";

    } catch (error) {
        console.error("Loading slots failed:", error);
        if (messageEl) {
            messageEl.textContent =
                "Cannot load slots. Check the backend server.";
        }
    }
}

async function updateSlot(slotName, status, vehicleNumber) {
    try {
        const response = await fetch(
            API_URL + "/slots/" + encodeURIComponent(slotName),
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: status,
                    vehicleNumber: vehicleNumber
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not update parking slot");
        }

        if (messageEl) messageEl.textContent = data.message;

        await loadSlots();

    } catch (error) {
        alert(error.message);
        console.error("Updating slot failed:", error);
    }
}

if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
        if (!confirm("Reset all parking slots?")) return;

        try {
            const response = await fetch(API_URL + "/reset", {
                method: "POST"
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Reset failed");
            }

            await loadSlots();

            if (messageEl) messageEl.textContent = data.message;

        } catch (error) {
            alert(error.message);
        }
    });
}

loadSlots();