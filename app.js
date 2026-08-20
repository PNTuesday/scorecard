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
    scores[player.name] = Array(18).fill(null);
});

function total(playerName) {
    return scores[playerName]
        .reduce((sum, value) => sum + (value || 0), 0);
}

function setScore(playerName, score) {
    scores[playerName][currentHole - 1] = score;
    render();
}

function render() {

    let html = `
    <div class="container">

        <div class="header">
            <h1>Group A Scorecard</h1>
            <p>Entry ID: X82K7P</p>
            <h2>Hole ${currentHole}</h2>

            <button onclick="previousHole()">Previous</button>
            <button onclick="nextHole()">Next</button>
        </div>
    `;

    players.forEach(player => {

        const currentScore =
          scores[player.name][currentHole - 1];

        html += `
        <div class="score-card">

            <div class="player-header">
                <div class="player-name">
                    ${player.name}
                </div>

                <div class="player-details">
                    ${player.tee} Tee |
                    Index ${player.index} |
                    HCP ${player.hcp}
                </div>
            </div>

            <div class="current-score">
                ${currentScore ?? "-"}
            </div>

            <div class="score-grid">
        `;

        for(let n = 1; n <= 8; n++) {

            const selected =
                currentScore === n
                ? "selected"
                : "";

            html += `
                <button
                  class="score-btn ${selected}"
                  onclick="setScore('${player.name}', ${n})">
                  ${n}
                </button>
            `;
        }

        html += `
            <button
              class="score-btn reset"
              onclick="setScore('${player.name}', null)">
              ↺
            </button>

            </div>
        </div>
        `;
    });

    html += `
        <div class="totals">
            <h2>Running Totals</h2>
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

render();
