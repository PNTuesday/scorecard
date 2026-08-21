const players = [
    {
        name: "Bob Smith",
        tee: "Gold",
        index: 10.2,
        hcp: 12
    },
    {
        name: "Mike Jones",
        tee: "White",
        index: 14.8,
        hcp: 16
    },
    {
        name: "Tom Wilson",
        tee: "Gold",
        index: 8.5,
        hcp: 10
    },
    {
        name: "Jim Brown",
        tee: "White",
        index: 18.1,
        hcp: 20
    }
];

let currentHole = 1;

const scores = {};

players.forEach(player => {
    scores[player.name] = Array(18).fill(4);
});

function total(playerName) {

    let total = 0;

    for (let i = 0; i < currentHole; i++) {
        total += scores[playerName][i];
    }

    return total;
}

function changeScore(playerName, delta) {

    let currentValue =
        scores[playerName][currentHole - 1];

    let newValue = currentValue + delta;

    if (newValue < 0) newValue = 0;
    if (newValue > 8) newValue = 8;

    scores[playerName][currentHole - 1] = newValue;

    render();
}

function nextHole() {

    if (currentHole < 18) {
        currentHole++;
        render();
    }
}

function previousHole() {

    if (currentHole > 1) {
        currentHole--;
        render();
    }
}

function render() {

    let html = `
        <div class="container">

            <div class="header">

                <h1>Group A Scorecard</h1>

                <p>
                    <strong>Entry ID:</strong>
                    X82K7P
                </p>

                <div style="text-align:right;font-weight:bold;">
                    Hole ${currentHole} | Par 4 | HCP ?
                </div>

                <div class="nav-buttons">

                    <button onclick="previousHole()">
                        Previous Hole
                    </button>

                    <button onclick="nextHole()">
                        Next Hole
                    </button>

                </div>

            </div>
    `;

    players.forEach(player => {

        const score =
            scores[player.name][currentHole - 1];

        const scoreClass =
            score === 0
                ? "score-zero"
                : "score-normal";

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
                        onclick="changeScore('${player.name}', -1)">
                        ◀
                    </button>

                    <div class="score-display ${scoreClass}">
                        ${score}
                    </div>

                    <button
                        class="arrow-btn"
                        onclick="changeScore('${player.name}', 1)">
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

render();
