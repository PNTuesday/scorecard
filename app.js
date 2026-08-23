const emailServiceId = "service_tu81pmn";
const emailTemplateId = "template_sturumn";

let courseData;
let roundData;
let players = [];
let currentHole = 1;
let verified = false;
let submitting = false;
let submitted = false;
let submissionMessage = "";

const scores = {};

async function loadData() {
    try {
        const roundId = getRoundIdFromUrl();

        if (!roundId) {
            throw new Error(
                "The scorecard link is missing its RoundID."
            );
        }

        const [courseResponse, roundResponse] =
            await Promise.all([
                fetch("course.json"),
                fetch(
                    `rounds/${encodeURIComponent(roundId)}.json`
                )
            ]);

        if (!courseResponse.ok) {
            throw new Error(
                `Unable to load course.json ` +
                `(${courseResponse.status}).`
            );
        }

        if (!roundResponse.ok) {
            throw new Error(
                `Unable to load round ${roundId} ` +
                `(${roundResponse.status}).`
            );
        }

        courseData = await courseResponse.json();
        roundData = await roundResponse.json();
        players = roundData.players;

        if (
            String(roundData.roundid).toUpperCase() !==
            roundId.toUpperCase()
        ) {
            throw new Error(
                "The requested RoundID does not match the round file."
            );
        }

        initializeScores();
        render();

    } catch (error) {
        console.error(error);

        document.getElementById("root").innerHTML = `
            <div class="container">
                <div class="header">
                    <h1>Unable to load scorecard</h1>
                    <p>${escapeHtml(error.message)}</p>
                </div>
            </div>
        `;
    }
}

function getRoundIdFromUrl() {
    const value = new URLSearchParams(
        window.location.search
    ).get("round");

    if (!value) {
        return "";
    }

    const roundId = value.trim();

    if (!/^[A-Za-z0-9_-]+$/.test(roundId)) {
        throw new Error(
            "The RoundID in the scorecard link is invalid."
        );
    }

    return roundId;
}

function initializeScores() {
    players.forEach(player => {
        scores[player.playerid] =
            courseData.holes.map(hole => hole.par);
    });
}

function total(playerId) {
    let playerTotal = 0;

    for (let i = 0; i < currentHole; i++) {
        playerTotal += scores[playerId][i];
    }

    return playerTotal;
}

function changeScore(playerIndex, delta) {
    if (submitted) {
        return;
    }

    const player = players[playerIndex];

    const currentValue =
        scores[player.playerid][currentHole - 1];

    const newValue = Math.min(
        8,
        Math.max(0, currentValue + delta)
    );

    scores[player.playerid][currentHole - 1] =
        newValue;

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
            playerid: player.playerid,
            displayname: player.displayname
        };

        scores[player.playerid].forEach(
            (score, index) => {
                playerScores[`H${index + 1}`] =
                    score;
            }
        );

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

    const templateParameters = {
        roundid: String(roundData.roundid),
        group: String(roundData.group),
        date: String(roundData.date),
        course: String(
            roundData.course ||
            courseData.coursename ||
            ""
        ),
        verified: "true",
        verifiedtimestamp:
            new Date().toISOString(),
        playercount: String(players.length),
        scores: JSON.stringify(
            buildScoreData(),
            null,
            2
        )
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
            `Round ID: ${roundData.roundid}`;

    } catch (error) {
        console.error(
            "EmailJS submission failed:",
            error
        );

        submissionMessage =
            "Submission failed. " +
            "Check the connection and try again.";

    } finally {
        submitting = false;
        render();
    }
}

function render() {
    const holeData =
        courseData.holes[currentHole - 1];

    const formattedDate =
        formatDate(roundData.date);

    const courseName =
        roundData.course ||
        courseData.coursename ||
        "";

    let html = `
        <div class="container">

            <div class="header">

                <h1>
                    Group ${escapeHtml(roundData.group)}
                    Scorecard
                </h1>

                <p>
                    <strong>
                        ${escapeHtml(courseName)}
                    </strong>

                    ${
                        formattedDate
                            ? ` | ${escapeHtml(
                                formattedDate
                            )}`
                            : ""
                    }
                </p>

                <p>
                    <strong>Round ID:</strong>
                    ${escapeHtml(roundData.roundid)}
                </p>

                <div class="hole-info">
                    Hole ${holeData.hole} |
                    Par ${holeData.par} |
                    HCP ${holeData.hcp}
                </div>

                <div class="nav-buttons">

                    <button
                        onclick="previousHole()"
                        ${
                            currentHole === 1
                                ? "disabled"
                                : ""
                        }>
                        Previous Hole
                    </button>

                    <button
                        onclick="nextHole()"
                        ${
                            currentHole ===
                            courseData.holes.length
                                ? "disabled"
                                : ""
                        }>
                        Next Hole
                    </button>

                </div>
            </div>
    `;

    players.forEach(
        (player, playerIndex) => {

            const score =
                scores[player.playerid][
                    currentHole - 1
                ];

            const scoreClass =
                score === 0
                    ? "score-zero"
                    : "score-normal";

            html += `
                <div class="score-card">

                    <div class="player-name">
                        ${escapeHtml(
                            player.displayname
                        )}
                    </div>

                    <div class="player-details">
                        ${escapeHtml(player.tee)}
                        Tee |
                        HCP ${escapeHtml(player.hcp)}
                    </div>

                    <div class="score-selector">

                        <button
                            class="arrow-btn"
                            onclick="
                                changeScore(
                                    ${playerIndex},
                                    -1
                                )
                            "
                            ${
                                submitted
                                    ? "disabled"
                                    : ""
                            }>
                            ◀
                        </button>

                        <div
                            class="
                                score-display
                                ${scoreClass}
                            ">
                            ${score}
                        </div>

                        <button
                            class="arrow-btn"
                            onclick="
                                changeScore(
                                    ${playerIndex},
                                    1
                                )
                            "
                            ${
                                submitted
                                    ? "disabled"
                                    : ""
                            }>
                            ▶
                        </button>

                    </div>
                </div>
            `;
        }
    );

    html += `
        <div class="totals">
            <h2>Through Hole ${currentHole}</h2>
    `;

    players.forEach(player => {
        html += `
            <div class="total-player">
                <span>
                    ${escapeHtml(
                        player.displayname
                    )}
                </span>

                <strong>
                    ${total(player.playerid)}
                </strong>
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
                    onchange="
                        setVerified(this.checked)
                    "
                    ${verified ? "checked" : ""}>

                I have verified these scores
                against the paper scorecard.
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
                    ">

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
        html += `
            <p style="
                margin-top: 12px;
                font-weight: bold;
                color:
                    ${
                        submitted
                            ? "#065f46"
                            : "#991b1b"
                    };
            ">
                ${escapeHtml(submissionMessage)}
            </p>
        `;
    }

    html += `
        </div>
        </div>
    `;

    document.getElementById("root").innerHTML =
        html;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

loadData();