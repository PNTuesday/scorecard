let courseData = null;
let playersData = null;
let players = [];
let currentHole = 1;

const scores = {};

async function loadData() {
    try {
        const [courseResponse, playersResponse] = await Promise.all([
            fetch("course.json"),
            fetch("players.json")
        ]);

        if (!courseResponse.ok) {
            throw new Error("Unable to load course.json");
        }

        if (!playersResponse.ok) {
            throw new Error("Unable to load players.json");
        }

        courseData = await courseResponse.json();
        playersData = await playersResponse.json();
        players = playersData.players;

        initializeScores();
        render();
    } catch (error) {
        document.getElementById("root").innerHTML = `
            <div class="container">
                <div class="header">
                    <h1>Unable to load scorecard</h1>
                    <p>${error.message}</p>
                </div>
            </div>
        `;

        console.error(error);
    }
}

function initializeScores() {
    players.forEach(player => {
        scores[player.name] = courseData.holes.map(hole => hole.par);
    });
}

function total(playerName) {
    let playerTotal = 0;

    for (let i = 0; i < currentHole; i++) {
        playerTotal += scores[playerName][i];
    }

    return playerTotal;
}

function changeScore(playerIndex, delta) {
    const player = players[playerIndex];
    const currentValue = scores[player.name][currentHole - 1];

    let newValue = currentValue + delta;

    if (newValue < 0) {
        newValue = 0;
    }

    if (newValue > 8) {
        newValue = 8;
    }

    scores[player.name][currentHole - 1] = newValue;
    render();
}

function nextHole() {
    if (currentHole < courseData.holes.length) {
        currentHole++;
        render();
        window.scrollTo(0, 0);
    }
}

function previousHole() {
    if (currentHole > 1) {
        currentHole--;
        render();
        window.scrollTo(0, 0);
    }
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "";
    }

    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateValue;
    }

    return date.toLocaleDateString();
}

function render() {
    const holeData = courseData.holes[currentHole - 1];
    const formattedDate = formatDate(playersData.date);

    let html = `
        <div class="container">
            <div class="header">
                <h1>Group ${playersData.group} Scorecard</h1>

                <p>
                    <strong>${playersData.course}</strong>
                    ${formattedDate ? ` | ${formattedDate}` : ""}
                </p>

                <p>
                    <strong>Entry ID:</strong>
                    ${playersData.entryid}
                </p>

                <div class="hole-info">
                    Hole ${holeData.hole} |
                    Par ${holeData.par} |
                    HCP ${holeData.hcp}
                </div>

                <div class="nav-buttons">
                    <button
                        onclick="previousHole()"
                        ${currentHole === 1 ? "disabled" : ""}>
                        Previous Hole
                    </button>

                    <button
                        onclick="nextHole()"
                        ${currentHole === courseData.holes.length
                            ? "disabled"
                            : ""}>
                        Next Hole
                    </button>
                </div>
            </div>
    `;

    players.forEach((player, playerIndex) => {
        const score = scores[player.name][currentHole - 1];

        const scoreClass =
            score === 0 ? "score-zero" : "score-normal";

        html += `
            <div class="score-card">
                <div class="player-name">
                    ${player.name}
                </div>

                <div class="player-details">
                    ${player.tee} Tee |
                    Index ${player.index} |
                    HCP ${player.hcp}
                </div>

                <div class="score-selector">
                    <button
                        class="arrow-btn"
                        onclick="changeScore(${playerIndex}, -1)">
                        ◀
                    </button>

                    <div class="score-display ${scoreClass}">
                        ${score}
                    </div>

                    <button
                        class="arrow-btn"
                        onclick="changeScore(${playerIndex}, 1)">
                        ▶
                    </button>
                </div>
            </div>
        `;
    });

    html += `
            <div class="totals">
                <h2>Through Hole ${currentHole}</h2>
    `;

    players.forEach(player => {
        html += `
                <div class="total-player">
                    <span>${player.name}</span>
                    <strong>${total(player.name)}</strong>
                </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    document.getElementById("root").innerHTML = html;
}

loadData();
