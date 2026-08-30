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
let fullScorecardOpen = false;

const scores = {};
const confirmed = {};
const savedHoles = Array(18).fill(false);
const dirtyHoles = Array(18).fill(false);
const withdrawn = {};
const withdrawalMode = {};
const withdrawalBackup = {};
const savedScoreSnapshots = {};

const STORAGE_PREFIX = "golf-scorecard:";


function ensureConfirmationStyles() {
    if (document.getElementById("confirmation-styles")) return;

    const style = document.createElement("style");
    style.id = "confirmation-styles";
    style.textContent = `
        .score-display { border: none; cursor: pointer; }
        .score-unconfirmed { background: #d1d5db; color: #111827; }
        .progress-card { overflow-x: auto; }
        .progress-title { margin: 0 0 5px; color: #111827; font-size: 1.08rem; line-height: 1.05; }
        .progress-grid {
            display: grid;
            grid-template-columns: 2.25rem repeat(9, minmax(1.45rem, 1fr)) 2.4rem;
            gap: 2px;
            align-items: center;
            min-width: 22rem;
            color: #111827;
            font-family: Consolas, "Courier New", monospace;
            font-size: 0.88rem;
            font-weight: 600;
            line-height: 1.4;
            text-align: center;
        }
        .progress-grid .progress-name { text-align: left; font-weight: 700; }
        .progress-grid .progress-header { font-weight: 700; }
        .progress-grid .progress-total { font-weight: 700; }
        .player-score-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; line-height: 1; }
        .player-score-row .player-name { margin: 0; padding: 0; font-size: 1.08rem; line-height: 1; font-weight: 700; }
        .player-score-row .score-selector { margin: 0; flex: 0 0 auto; }
        .compact-player-card .player-details { margin: 0; padding: 0; line-height: 1; }
        .player-name-out { color: #991b1b; }
        .player-details-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .out-toggle { font-size: 0.78rem; font-weight: 700; color: #991b1b; white-space: nowrap; }
        .out-toggle input { margin-right: 4px; }
        .player-out-card { background: #f3f4f6; }
        .withdrawn-row td { text-align: left; font-family: inherit; font-size: 1rem; font-weight: 700; }
        .progress-actions { margin-top: 8px; }
        .full-scorecard-btn { width: 100%; padding: 10px; border: none; border-radius: 9px; background: #1f4f3d; color: white; font-weight: 700; }
        .scorecard-overlay { position: fixed; inset: 0; z-index: 9999; background: white; color: #111827; padding: 10px; overflow: auto; }
        .scorecard-overlay-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
        .scorecard-overlay-header h2 { margin: 0; font-size: 1.1rem; }
        .scorecard-close-btn { padding: 8px 12px; border: none; border-radius: 8px; background: #444; color: white; font-weight: 700; }
        .full-scorecard-wrap { overflow-x: auto; }
        .full-scorecard { border-collapse: collapse; table-layout: fixed; width: 988px; min-width: 988px; font-family: Consolas, "Courier New", monospace; font-size: 1rem; font-weight: 700; text-align: center; }
        .full-scorecard th, .full-scorecard td { box-sizing: border-box; width: 42px; min-width: 42px; max-width: 42px; border: 1px solid #777; padding: 6px 2px; white-space: nowrap; font-size: 1rem; }
        .full-scorecard th:first-child, .full-scorecard td:first-child { position: sticky; left: 0; z-index: 1; background: white; text-align: left; width: 64px; min-width: 64px; max-width: 64px; }
        .full-scorecard .subtotal { background: #eeeeee; }
        .rotate-note { margin: 4px 0 8px; font-size: 0.8rem; }
        .hole-number-large { font-size: 3.5rem; font-weight: 800; line-height: 1; text-align: center; color: #111827; margin: 8px 0 4px; }
        .hole-details { text-align: center; font-weight: 700; }

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
        withdrawn[player.playerid] = false;
        withdrawalMode[player.playerid] = "";
    });
}


function getHoleScoreSnapshot(holeIndex) {
    return players.map(player =>
        Number(scores[player.playerid][holeIndex])
    );
}

function rememberSavedHole(holeIndex) {
    savedScoreSnapshots[holeIndex] = getHoleScoreSnapshot(holeIndex);
}

function holeScoresDifferFromSaved(holeIndex) {
    const savedSnapshot = savedScoreSnapshots[holeIndex];

    if (!Array.isArray(savedSnapshot)) {
        return savedHoles[holeIndex];
    }

    const currentSnapshot = getHoleScoreSnapshot(holeIndex);

    return currentSnapshot.some((score, index) =>
        score !== Number(savedSnapshot[index])
    );
}

function refreshHoleDirtyState(holeIndex) {
    dirtyHoles[holeIndex] =
        savedHoles[holeIndex] && holeScoresDifferFromSaved(holeIndex);
}

function changeScore(playerIndex, delta) {
    if (submitted) return;

    const player = players[playerIndex];
    const playerId = player.playerid;
    if (withdrawn[playerId]) return;
    const currentValue = scores[playerId][currentHole - 1];
    const newValue = Math.min(8, Math.max(0, currentValue + delta));

    if (newValue === currentValue) return;

    scores[playerId][currentHole - 1] = newValue;

    if (savedHoles[currentHole - 1]) {
        confirmed[playerId][currentHole - 1] = false;
        refreshHoleDirtyState(currentHole - 1);
    } else {
        confirmed[playerId][currentHole - 1] = true;
    }

    verified = false;
    submissionMessage = "";
    saveScores();
    render();
}

function confirmCurrentScore(playerIndex) {
    if (submitted) return;

    const player = players[playerIndex];
    const playerId = player.playerid;
    if (withdrawn[playerId]) return;
    const holeIndex = currentHole - 1;

    if (savedHoles[holeIndex] && confirmed[playerId][holeIndex]) {
        return;
    }

    confirmed[playerId][holeIndex] = true;
    verified = false;
    submissionMessage = "";
    saveScores();
    render();
}

function hasCompletedFrontNine(playerId) {
    return savedHoles.slice(0, 9).every(Boolean) &&
        confirmed[playerId].slice(0, 9).every(Boolean);
}

function getBlindName(playerIndex) {
    return `Blind-${String.fromCharCode(65 + playerIndex)}`;
}

function setPlayerOut(playerIndex, makeOut) {
    if (submitted) return;
    const player = players[playerIndex];
    const playerId = player.playerid;

    if (makeOut) {
        if (!window.confirm(`Mark ${player.displayname} OUT for the remainder of the round?`)) {
            render();
            return;
        }
        withdrawalBackup[playerId] = {
            scores: [...scores[playerId]],
            confirmed: [...confirmed[playerId]]
        };
        const afterNine = hasCompletedFrontNine(playerId);
        const startIndex = afterNine ? 9 : 0;
        withdrawn[playerId] = true;
        withdrawalMode[playerId] = afterNine ? "afterNine" : "beforeNine";
        for (let index = startIndex; index < 18; index++) {
            scores[playerId][index] = 0;
            confirmed[playerId][index] = true;
        }
    } else {
        if (!window.confirm(`Restore ${player.displayname} to active scoring?`)) {
            render();
            return;
        }
        withdrawn[playerId] = false;
        withdrawalMode[playerId] = "";

        for (let index = 0; index < 18; index++) {
            if (savedHoles[index]) {
                confirmed[playerId][index] = true;
            }
        }
    }

    if (savedHoles[currentHole - 1]) {
        refreshHoleDirtyState(currentHole - 1);
    } else {
        dirtyHoles[currentHole - 1] = true;
    }
    verified = false;
    submissionMessage = "";
    saveScores();
    render();
}

function isWithdrawnHole(playerId, holeIndex) {
    if (!withdrawn[playerId]) return false;
    return withdrawalMode[playerId] === "beforeNine" || holeIndex >= 9;
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

function isCurrentHoleComplete() {
    return players.every(player =>
        confirmed[player.playerid][currentHole - 1]
    );
}


function isCurrentHoleSaved() {
    return savedHoles[currentHole - 1];
}

function hasUnsavedChanges() {
    return dirtyHoles[currentHole - 1];
}

function getSaveButtonText() {
    if (hasUnsavedChanges()) return "Save Changes";
    if (isCurrentHoleSaved()) return "Saved";

    return currentHole < courseData.holes.length
        ? "Save Hole & Go to Next"
        : "Save Hole 18";
}

function hasPendingSave() {
    return hasUnsavedChanges() ||
        (isCurrentHoleComplete() && !isCurrentHoleSaved());
}

function canNavigateAway() {
    return !hasPendingSave();
}

function isRoundFullySaved() {
    return savedHoles.length === courseData.holes.length &&
        savedHoles.every(Boolean) &&
        dirtyHoles.every(isDirty => !isDirty) &&
        isScorecardComplete();
}

function getPlayerInitials(displayName) {
    const parts = String(displayName)
        .replaceAll(".", "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}

function confirmedNineTotal(playerId, startIndex) {
    let nineTotal = 0;

    for (let index = startIndex; index < startIndex + 9; index++) {
        if (confirmed[playerId][index]) {
            nineTotal += scores[playerId][index];
        }
    }

    return nineTotal;
}

function buildProgressScorecard() {
    const frontNine = currentHole <= 9;
    const startIndex = frontNine ? 0 : 9;
    const totalLabel = frontNine ? "OUT" : "IN";
    const holeNumbers = Array.from(
        { length: 9 },
        (_, index) => startIndex + index + 1
    );

    let progressHtml = `
        <div class="score-card progress-card">
            <h2 class="progress-title">Progress</h2>
            <div class="progress-grid">
                <span class="progress-header"></span>
                ${holeNumbers.map(hole =>
                    `<span class="progress-header">${hole}</span>`
                ).join("")}
                <span class="progress-header progress-total">${totalLabel}</span>
    `;

    players.forEach(player => {
        const playerId = player.playerid;

        progressHtml += `
            <span class="progress-name">${escapeHtml(getPlayerInitials(player.displayname))}${withdrawn[playerId] ? "*" : ""}</span>
            ${holeNumbers.map(hole => {
                const index = hole - 1;
                const value = isWithdrawnHole(playerId, index)
                    ? "X"
                    : confirmed[playerId][index] ? scores[playerId][index] : "-";
                return `<span>${value}</span>`;
            }).join("")}
            <span class="progress-total">${confirmedNineTotal(playerId, startIndex)}</span>
        `;
    });

    progressHtml += `
            </div>
            ${isRoundFullySaved() ? `
                <div class="progress-actions">
                    <button class="full-scorecard-btn" onclick="openFullScorecard()">
                        View Full Scorecard
                    </button>
                </div>
            ` : ""}
        </div>
    `;

    return progressHtml;
}

function fullRoundTotal(playerId) {
    if (withdrawalMode[playerId] === "beforeNine") return 0;
    return scores[playerId].reduce((sum, value) => sum + value, 0);
}

function buildFullScorecard() {
    const frontHoles = Array.from({ length: 9 }, (_, index) => index + 1);
    const backHoles = Array.from({ length: 9 }, (_, index) => index + 10);

    let html = `
        <div class="scorecard-overlay" id="full-scorecard-overlay">
            <div class="scorecard-overlay-header">
                <h2>Group ${escapeHtml(roundData.group)} Full Scorecard</h2>
                <button class="scorecard-close-btn" onclick="closeFullScorecard()">Close</button>
            </div>
            <p class="rotate-note">Rotate the phone to landscape for the widest view. Swipe sideways if needed.</p>
            <div class="full-scorecard-wrap">
                <table class="full-scorecard">
                    <thead>
                        <tr>
                            <th>Player</th>
                            ${frontHoles.map(hole => `<th>${hole}</th>`).join("")}
                            <th class="subtotal">OUT</th>
                            ${backHoles.map(hole => `<th>${hole}</th>`).join("")}
                            <th class="subtotal">IN</th>
                            <th class="subtotal">TOT</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    players.forEach(player => {
        const playerId = player.playerid;
        if (withdrawalMode[playerId] === "beforeNine") {
            html += `<tr class="withdrawn-row"><td>${escapeHtml(getPlayerInitials(player.displayname))}</td><td colspan="21">Player Withdrawn</td></tr>`;
            return;
        }
        html += `
            <tr>
                <td>${escapeHtml(getPlayerInitials(player.displayname))}${withdrawn[playerId] ? " (OUT)" : ""}</td>
                ${frontHoles.map(hole => `<td>${scores[playerId][hole - 1]}</td>`).join("")}
                <td class="subtotal">${confirmedNineTotal(playerId, 0)}</td>
                ${backHoles.map(hole => `<td>${isWithdrawnHole(playerId, hole - 1) ? "X" : scores[playerId][hole - 1]}</td>`).join("")}
                <td class="subtotal">${withdrawn[playerId] ? 0 : confirmedNineTotal(playerId, 9)}</td>
                <td class="subtotal">${fullRoundTotal(playerId)}</td>
            </tr>`;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    return html;
}

async function openFullScorecard() {
    if (!isRoundFullySaved()) return;

    fullScorecardOpen = true;
    render();

    const overlay = document.getElementById("full-scorecard-overlay");

    try {
        if (overlay?.requestFullscreen) {
            await overlay.requestFullscreen();
        }

        if (screen.orientation?.lock) {
            await screen.orientation.lock("landscape");
        }
    } catch (error) {
        console.info("Landscape lock is not available in this browser.", error);
    }
}

function closeFullScorecard() {
    fullScorecardOpen = false;

    try {
        if (screen.orientation?.unlock) {
            screen.orientation.unlock();
        }
    } catch (error) {
        console.info("Orientation unlock is not available.", error);
    }

    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }

    render();
}

function buildMissingScoreMessage() {
    const grouped = {};

    getMissingScores().forEach(item => {
        if (!grouped[item.displayname]) grouped[item.displayname] = [];
        grouped[item.displayname].push(`H${item.hole}`);
    });

    return "Scorecard incomplete. Missing confirmations: " +
        Object.entries(grouped)
            .map(([name, holes]) => `${name}: ${holes.join(", ")}`)
            .join("; ");
}

function goToFirstMissingHole() {
    const firstMissing = getMissingScores()[0];
    if (!firstMissing) return;

    currentHole = firstMissing.hole;
    saveScores();
    window.scrollTo(0, 0);
}

function getGapScores() {
    let furthestConfirmedHole = 0;

    players.forEach(player => {
        confirmed[player.playerid].forEach((isConfirmed, index) => {
            if (isConfirmed) {
                furthestConfirmedHole = Math.max(furthestConfirmedHole, index + 1);
            }
        });
    });

    return getMissingScores().filter(item => item.hole < furthestConfirmedHole);
}

function hasScoreGap() {
    return getGapScores().length > 0;
}

function reviewMissingScores() {
    const firstGap = getGapScores()[0];
    if (!firstGap) return;

    currentHole = firstGap.hole;
    submissionMessage = "";
    saveScores();
    window.scrollTo(0, 0);
    render();
}

function saveCurrentHole() {
    if (isCurrentHoleSaved() && !hasUnsavedChanges()) return;

    if (!isCurrentHoleComplete()) {
        submissionMessage =
            `Hole ${currentHole} is incomplete. Confirm every player's score before saving.`;
        render();
        return;
    }

    const savedHole = currentHole;
    const isCorrection = hasUnsavedChanges();

    savedHoles[savedHole - 1] = true;
    rememberSavedHole(savedHole - 1);
    dirtyHoles[savedHole - 1] = false;
    submissionMessage = `Hole ${savedHole} saved.`;
    saveScores();

    if (!isCorrection && currentHole < courseData.holes.length) {
        currentHole++;
        saveScores();
        window.scrollTo(0, 0);
    }

    render();

    window.setTimeout(() => {
        if (submissionMessage === `Hole ${savedHole} saved.`) {
            submissionMessage = "";
            render();
        }
    }, 2500);
}

function nextHole() {
    if (!canNavigateAway()) return;

    if (currentHole < courseData.holes.length) {
        currentHole++;
        saveScores();
        render();
        window.scrollTo(0, 0);
    }
}

function previousHole() {
    if (!canNavigateAway()) return;

    if (currentHole > 1) {
        currentHole--;
        saveScores();
        render();
        window.scrollTo(0, 0);
    }
}

function setVerified(isChecked) {
    if (submitted) return;

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
            displayname: player.displayname,
            withdrawn: Boolean(withdrawn[player.playerid]),
            withdrawalmode: withdrawalMode[player.playerid] || "",
            blindname: withdrawn[player.playerid] ? getBlindName(players.indexOf(player)) : ""
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
    if (submitting || submitted) return;

    if (!isRoundFullySaved()) {
        verified = false;
        submissionMessage = "Every hole must be saved before submission.";
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
                            currentHole === 1 || !canNavigateAway()
                                ? "disabled"
                                : ""
                        }>
                        Previous Hole
                    </button>

                    <button
                        onclick="nextHole()"
                        ${
                            currentHole ===
                            courseData.holes.length || !canNavigateAway()
                                ? "disabled"
                                : ""
                        }>
                        Next Hole
                    </button>

                </div>

                <button
                    onclick="saveCurrentHole()"
                    ${isCurrentHoleComplete() && (!isCurrentHoleSaved() || hasUnsavedChanges()) && !submitted ? "" : "disabled"}
                    style="
                        width: 100%;
                        margin-top: 10px;
                        padding: 12px;
                        border: none;
                        border-radius: 10px;
                        background: ${isCurrentHoleComplete() && (!isCurrentHoleSaved() || hasUnsavedChanges()) ? "#065f46" : "#9ca3af"};
                        color: white;
                        font-size: 1rem;
                        font-weight: bold;
                    ">
                    ${getSaveButtonText()}
                </button>
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

            const isOut = withdrawn[player.playerid];
            const scoreClass =
                score === 0
                    ? "score-zero"
                    : isConfirmed
                        ? "score-normal"
                        : "score-unconfirmed";

            html += `
                <div class="score-card compact-player-card ${isOut ? "player-out-card" : ""}">
                    <div class="player-score-row">
                        <div class="player-name ${isOut ? "player-name-out" : ""}">
                            ${escapeHtml(player.displayname)}${isOut ? " (OUT)" : ""}
                        </div>
                        <div class="score-selector">
                            <button
                                class="arrow-btn"
                                onclick="changeScore(${playerIndex}, -1)"
                                ${submitted || isOut ? "disabled" : ""}>
                                ◀
                            </button>
                            <button
                                class="score-display ${scoreClass}"
                                onclick="confirmCurrentScore(${playerIndex})"
                                ${submitted || isOut ? "disabled" : ""}
                                aria-label="Confirm score ${score} for ${escapeHtml(player.displayname)}">
                                ${score}
                            </button>
                            <button
                                class="arrow-btn"
                                onclick="changeScore(${playerIndex}, 1)"
                                ${submitted || isOut ? "disabled" : ""}>
                                ▶
                            </button>
                        </div>
                    </div>
                    <div class="player-details-row">
                        <div class="player-details">
                            ${escapeHtml(player.tee)} Tee |
                            HCP ${escapeHtml(player.hcp)}
                        </div>
                        <label class="out-toggle">
                            <input type="checkbox"
                                onchange="setPlayerOut(${playerIndex}, this.checked)"
                                ${isOut ? "checked" : ""}
                                ${submitted ? "disabled" : ""}>
                            OUT
                        </label>
                    </div>
                </div>
            `;
        }
    );

    html += buildProgressScorecard();

    html += `
        <div class="score-card">
    `;

    if (!submitted) {
        if (hasScoreGap()) {
            html += `
                <button
                    onclick="reviewMissingScores()"
                    style="
                        width: 100%; padding: 14px; border: none;
                        border-radius: 10px; background: #f59e0b;
                        color: #111827; font-size: 1rem; font-weight: bold;
                    ">
                    Review Missing Scores
                </button>
            `;
        }

        if (isRoundFullySaved()) {
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
                            width: 100%; margin-top: 12px; padding: 14px;
                            border: none; border-radius: 10px;
                            background: #065f46; color: white;
                            font-size: 1rem; font-weight: bold;
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

    if (fullScorecardOpen) {
        html += buildFullScorecard();
    }

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
        confirmed,
        savedHoles,
        dirtyHoles,
        withdrawn,
        withdrawalMode,
        withdrawalBackup,
        savedScoreSnapshots
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

        if (Array.isArray(savedData.savedHoles)) {
            savedData.savedHoles.slice(0, 18).forEach((saved, index) => {
                savedHoles[index] = Boolean(saved);
            });
        } else {
            for (let index = 0; index < 18; index++) {
                savedHoles[index] = players.every(player =>
                    confirmed[player.playerid][index]
                );
            }
        }

        if (Array.isArray(savedData.dirtyHoles)) {
            savedData.dirtyHoles.slice(0, 18).forEach((dirty, index) => {
                dirtyHoles[index] = Boolean(dirty);
            });
        }

        if (savedData.withdrawn) players.forEach(player => {
            withdrawn[player.playerid] = Boolean(savedData.withdrawn[player.playerid]);
        });
        if (savedData.withdrawalMode) players.forEach(player => {
            withdrawalMode[player.playerid] = savedData.withdrawalMode[player.playerid] || "";
        });
        if (savedData.withdrawalBackup) Object.keys(savedData.withdrawalBackup).forEach(playerId => {
            const backup = savedData.withdrawalBackup[playerId];
            withdrawalBackup[playerId] = {
                scores: Array.isArray(backup.scores) ? [...backup.scores] : [],
                confirmed: Array.isArray(backup.confirmed) ? [...backup.confirmed] : []
            };
        });

        if (savedData.savedScoreSnapshots) {
            Object.keys(savedData.savedScoreSnapshots).forEach(holeIndex => {
                const snapshot = savedData.savedScoreSnapshots[holeIndex];
                if (Array.isArray(snapshot)) {
                    savedScoreSnapshots[holeIndex] = snapshot.map(Number);
                }
            });
        }

        for (let index = 0; index < 18; index++) {
            if (savedHoles[index] && !Array.isArray(savedScoreSnapshots[index])) {
                rememberSavedHole(index);
            }
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