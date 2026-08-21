const emailServiceId = "service_tu81pmn";
const emailTemplateId = "template_sturumn";

let courseData;
let playersData;
let players = [];
let currentHole = 1;
let verified = false;
let submitting = false;
let submitted = false;
let submissionMessage = "";

const scores = {};

async function loadData() {
    try {
        const [courseResponse, playersResponse] = await Promise.all([
            fetch("course.json"),
            fetch("players.json")
        ]);

        if (!courseResponse.ok) {
            throw new Error(
                `Unable to load course.json (${courseResponse.status})`
            );
        }

        if (!playersResponse.ok) {
            throw new Error(
                `Unable to load players.json (${playersResponse.status})`
            );
        }

        courseData = await courseResponse.json();
        playersData = await playersResponse.json();
        players = playersData.players;

        initializeScores();
        render();
    } catch (error) {
        console.error(error);

        document.getElementById("root").innerHTML = `
            <div class="container">
                <div class="header">
                    <h1>Unable to load scorecard</h1>
                    <p>${error.message}</p>
                </div>
            </div>
        `;
    }
}

function initializeScores() {
    players.forEach(player => {
        scores[player.name] =
            courseData.holes.map(hole => hole.par);
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
    if (submitted) {
        return;
    }

    const player = players[playerIndex];
    const currentValue =
        scores[player.name][currentHole - 1];

    const newValue = Math.min(
        8,
        Math.max(0, currentValue + delta)
    );

    scores[player.name][currentHole - 1] = newValue;

    verified = false;
    submissionMessage = "";

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

function setVerified(isChecked) {
    if (submitted) {
        return;
    }

    verified = isChecked;
    submissionMessage = "";

    render();
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "";
    }

    const parts = String(dateValue).split("-");

    if (parts.length !== 3) {
        return String(dateValue);
    }

    return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function buildScoreData() {
    return players.map(player => {
        const playerScores = {
            player: player.name
        };

        scores[player.name].forEach((score, index) => {
            playerScores[`H${index + 1}`] = score;
        });

        return playerScores;
    });
}

async function submitScores() {
    if (!verified || submitting || submitted) {
        return;
    }

    submitting = true;
    submissionMessage = "Submitting scores...";

    render();

    const scoreData = buildScoreData();
    const verifiedTimestamp = new Date().toISOString();

    const templateParameters = {
        roundid: String(playersData.roundid),
        group: String(playersData.group),
        date: String(playersData.date),
        course: String(playersData.course),
        verified: "true",
        verifiedtimestamp: verifiedTimestamp,
        playercount: String(players.length),
        scores: JSON.stringify(scoreData, null, 2)
    };

    try {
        await emailjs.send(
            emailServiceId,
            emailTemplateId,
            templateParameters
        );

        submitted = true;

        submissionMessage =
            `Scores submitted successfully. ` +
            `Round ID: ${playersData.roundid}`;
    } catch (error) {
        console.error(
            "EmailJS submission failed:",
            error
        );

        submissionMessage =
            "Submission failed. Check the connection and try again.";
    } finally {
        submitting = false;
        render();
    }
}

function render() {
    const holeData =
        courseData.holes[currentHole - 1];

    const formattedDate =
        formatDate(playersData.date);

    let html = `
        <div class="container">

            <div class="header">
                <h1>
                    Group ${playersData.group} Scorecard
                </h1>

                <p>
                    <strong>${playersData.course}</strong>
                    ${formattedDate
                        ? ` | ${formattedDate}`
                        : ""}
                </p>

                <p>
                    <strong>Round ID:</strong>
                    ${playersData.roundid}
                </p>

                <div class="hole-info">
                    Hole ${holeData.hole} |
                    Par ${holeData.par} |
                    HCP ${holeData.hcp}
                </div>

                <div class="nav-buttons">
                    <button
                        onclick="previousHole()"
                        ${currentHole === 1
                            ? "disabled"
                            : ""}
                    >
                        Previous Hole
                    </button>

                    <button
                        onclick="nextHole()"
                        ${
                            currentHole ===
                            courseData.holes.length
                                ? "disabled"
                                : ""
                        }
                    >
                        Next Hole
                    </button>
                </div>
            </div>
    `;

    players.forEach((player, playerIndex) => {
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
                        onclick="changeScore(${playerIndex}, -1)"
                        ${submitted ? "disabled" : ""}
                    >
                        ◀
                    </button>

                    <div class="score-display ${scoreClass}">
                        ${score}
                    </div>

                    <button
                        class="arrow-btn"
                        onclick="changeScore(${playerIndex}, 1)"
                        ${submitted ? "disabled" : ""}
                    >
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

            <div class="score-card">
    `;

    if (!submitted) {
        html += `
                <label>
                    <input
                        type="checkbox"
                        onchange="setVerified(this.checked)"
                        ${verified ? "checked" : ""}
                    >

                    I have verified these scores against
                    the paper scorecard.
                </label>
        `;

        if (verified) {
            html += `
                <button
                    onclick="submitScores()"
                    ${submitting ? "disabled" : ""}
                    style="
                        width: 100%;
                        margin-top: 12px;
                        padding: 14px;
                        border: none;
                        border-radius: 10px;
                        background: #065f46;
                        color: white;
                        font-size: 1rem;
                        font-weight: bold;
                    "
                >
                    ${
                        submitting
                            ? "Submitting..."
                            : "Submit Verified Scores"
                    }
                </button>
            `;
        }
    }

    if (submissionMessage) {
        const messageColor =
            submitted ? "#065f46" : "#991b1b";

        html += `
                <p style="
                    margin-top: 12px;
                    font-weight: bold;
                    color: ${messageColor};
                ">
                    ${submissionMessage}
                </p>
        `;
    }

    html += `
            </div>
        </div>
    `;

    document.getElementById("root").innerHTML = html;
}

loadData();
