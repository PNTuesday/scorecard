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
const confirmed = {};

const STORAGE_PREFIX = "golf-scorecard:";


function ensureConfirmationStyles() {
    if (document.getElementById("confirmation-styles")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "confirmation-styles";
    style.textContent = `
        .score-display { border: none; cursor: pointer; }
        .score-unconfirmed { background: #d1d5db; color: #111827; }
    `;

    document.head.appendChild(style);
}

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

        restoreScores();
        ensureConfirmationStyles();

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

        confirmed[player.playerid] =
            courseData.holes.map(() => false);
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

    confirmed[player.playerid][currentHole - 1] = true;

    verified = false;
    submissionMessage = "";

    saveScores();

    render();
}

function confirmCurrentScore(playerIndex) {
    if (submitted) {
        return;
    }

    const player = players[playerIndex];

    confirmed[player.playerid][currentHole - 1] = true;
    verified = false;
    submissionMessage = "";

    saveScores();
    render();
}

function getMissingScores() {
    const missing = [];

    players.forEach(player => {
        confirmed[player.playerid].forEach((isConfirmed, index) => {
            if (!isConfirmed) {
                missing.push({
                    displayname: player.displayname,
                    hole: index + 1
                });
            }
        });
    });

    return missing;
}

function isScorecardComplete() {
    return getMissingScores().length === 0;
}

function buildMissingScoreMessage() {
    const missing = getMissingScores();
    const grouped = {};

    missing.forEach(item => {
        if (!grouped[item.displayname]) {
            grouped[item.displayname] = [];
        }

        grouped[item.displayname].push(`H${item.hole}`);
    });

    return "Scorecard incomplete. Missing confirmations: " +
        Object.entries(grouped)
            .map(([name, holes]) => `${name}: ${holes.join(", ")}`)
            .join("; ");
}

function goToFirstMissingHole() {
    const firstMissing = getMissingScores()[0];

    if (!firstMissing) {
        return;
    }

    currentHole = firstMissing.hole;
    saveScores();
    window.scrollTo(0, 0);
}

function reviewMissingScores() {
    submissionMessage = buildMissingScoreMessage();
    goToFirstMissingHole();
    render();
}

function nextHole() {
    if (currentHole < courseData.holes.length) {
        currentHole++;
        saveScores();
        render();
        window.scrollTo(0, 0);
    }
}

function previousHole() {
    if (currentHole > 1) {
        currentHole--;
        saveScores();
        render();
        window.scrollTo(0, 0);
    }
}

function setVerified(isChecked) {
    if (submitted) {
        return;
    }

    if (isChecked && !isScorecardComplete()) {
        verified = false;
        submissionMessage = buildMissingScoreMessage();
        goToFirstMissingHole();
        render();
        return;
    }

    verified = isChecked;
    submissionMessage = "";

    saveScores();
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

function buildScoreSummary() {

    return players.map(player => {

        const holeScores = scores[player.playerid];

        const out =
            holeScores
                .slice(0, 9)
                .reduce((sum, val) => sum + val, 0);

        const inn =
            holeScores
                .slice(9, 18)
                .reduce((sum, val) => sum + val, 0);

        const total = out + inn;

        const id =
            player.playerid.padEnd(6);

        const name =
            player.displayname.padEnd(12);

        const front =
            holeScores
                .slice(0, 9)
                .map(score => String(score))
                .join(" ");

        const back =
            holeScores
                .slice(9, 18)
                .map(score => String(score))
                .join(" ");

        return (
            `${id} ${name} ` +
            `${front} | ${String(out).padStart(2)} | ` +
            `${back} | ${String(inn).padStart(2)} | ` +
            `${String(total).padStart(3)}`
        );

    }).join("\n");

}

async function submitScores() {
    if (submitting || submitted) {
        return;
    }

    if (!isScorecardComplete()) {
        verified = false;
        submissionMessage = buildMissingScoreMessage();
        goToFirstMissingHole();
        render();
        return;
    }

    if (!verified) {
        submissionMessage =
            "Verify the completed scores against the paper scorecard before submitting.";
        render();
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

	summary: buildScoreSummary(),

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

            const isConfirmed =
                confirmed[player.playerid][currentHole - 1];

            const scoreClass =
                score === 0
                    ? "score-zero"
                    : isConfirmed
                        ? "score-normal"
                        : "score-unconfirmed";

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

                        <button
                            class="score-display ${scoreClass}"
                            onclick="confirmCurrentScore(${playerIndex})"
                            ${submitted ? "disabled" : ""}
                            aria-label="Confirm score ${score} for ${escapeHtml(player.displayname)}">
                            ${score}
                        </button>

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
        const missingCount = getMissingScores().length;

        if (missingCount > 0) {
            html += `
                <p style="margin: 0 0 10px; color: #991b1b; font-weight: bold;">
                    ${missingCount} score confirmation${missingCount === 1 ? "" : "s"} remaining.
                </p>

                <button
                    onclick="reviewMissingScores()"
                    style="
                        width: 100%;
                        padding: 14px;
                        border: none;
                        border-radius: 10px;
                        background: #f59e0b;
                        color: #111827;
                        font-size: 1rem;
                        font-weight: bold;
                    ">
                    Review Missing Scores
                </button>
            `;
        } else {
            html += `
                <label>
                    <input
                        type="checkbox"
                        onchange="setVerified(this.checked)"
                        ${verified ? "checked" : ""}>
                    I have verified these scores against the paper scorecard.
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
                        ${submitting ? "Submitting..." : "Submit Verified Scores"}
                    </button>
                `;
            }
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

function getStorageKey() {

    return (
        STORAGE_PREFIX +
        String(roundData.roundid)
    );

}

function saveScores() {

    if (!roundData) {
        return;
    }

    const saveData = {
        currentHole,
        scores,
        confirmed
    };

    localStorage.setItem(
        getStorageKey(),
        JSON.stringify(saveData)
    );

}

function restoreScores() {

    if (!roundData) {
        return;
    }

    const savedText =
        localStorage.getItem(
            getStorageKey()
        );

    if (!savedText) {
        return;
    }

    try {

        const savedData =
            JSON.parse(savedText);

        if (savedData.currentHole) {

            currentHole =
                savedData.currentHole;

        }

        if (savedData.scores) {

            Object.keys(
                savedData.scores
            ).forEach(playerId => {

                if (
                    scores[playerId]
                ) {

                    scores[playerId] =
                        savedData
                            .scores[
                                playerId
                            ];

                }

            });

        }

        if (savedData.confirmed) {

            Object.keys(savedData.confirmed).forEach(playerId => {

                if (confirmed[playerId]) {
                    confirmed[playerId] = savedData.confirmed[playerId];
                }

            });

        }

        submissionMessage =
            "Saved scorecard restored.";

    }
    catch (error) {

        console.error(
            "Restore failed",
            error
        );

    }

}
loadData();