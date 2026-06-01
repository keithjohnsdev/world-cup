"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GROUPS, getTeam, type Team } from "@/lib/data";

type Picks = Record<string, string>; // key: "stage:slot" → teamId

function TeamButton({
  team,
  selected,
  onClick,
  size = "md",
}: {
  team: Team;
  selected: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full rounded-xl border-2 transition-all text-left
        ${size === "sm" ? "px-2 py-1.5 text-sm" : "px-3 py-2.5"}
        ${
          selected
            ? "border-green-500 bg-green-50 font-semibold text-green-800"
            : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 text-gray-700"
        }`}
    >
      <span className={size === "sm" ? "text-lg" : "text-2xl"}>{team.flag}</span>
      <span className="truncate">{team.name}</span>
      {selected && <span className="ml-auto text-green-500">✓</span>}
    </button>
  );
}

function GroupCard({
  group,
  picks,
  onPick,
}: {
  group: (typeof GROUPS)[0];
  picks: Picks;
  onPick: (stage: string, slot: string, teamId: string) => void;
}) {
  const winner = picks[`group:${group.id}`];
  const runnerUp = picks[`runner:${group.id}`];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 text-lg">{group.name}</h3>
        <div className="flex gap-1 text-xs text-gray-400">
          {winner && (
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              1st: {getTeam(winner)?.flag}
            </span>
          )}
          {runnerUp && (
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              2nd: {getTeam(runnerUp)?.flag}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-2">Pick 1st place (required) and 2nd place (optional)</p>
      <div className="space-y-1.5">
        {group.teams.map((team) => {
          const isWinner = winner === team.id;
          const isRunner = runnerUp === team.id;
          return (
            <div key={team.id} className="flex gap-1.5">
              <button
                onClick={() => {
                  if (isWinner) {
                    onPick("group", group.id, "");
                  } else {
                    if (runnerUp === team.id) onPick("runner", group.id, "");
                    onPick("group", group.id, team.id);
                  }
                }}
                className={`flex-1 flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 transition-all text-left
                  ${isWinner ? "border-green-500 bg-green-50 font-semibold text-green-800" : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 text-gray-700"}`}
              >
                <span className="text-2xl">{team.flag}</span>
                <span className="truncate text-sm">{team.name}</span>
                {isWinner && <span className="ml-auto text-green-500 font-bold">1st</span>}
              </button>
              <button
                onClick={() => {
                  if (isRunner) {
                    onPick("runner", group.id, "");
                  } else {
                    if (winner === team.id) onPick("group", group.id, "");
                    onPick("runner", group.id, team.id);
                  }
                }}
                className={`px-2 rounded-xl border-2 transition-all text-xs font-bold
                  ${isRunner ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white hover:border-blue-300 text-gray-400"}`}
                title="Pick as 2nd place"
              >
                2nd
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlotBox({
  label,
  teamId,
  onClick,
  highlight,
}: {
  label: string;
  teamId?: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const team = teamId ? getTeam(teamId) : undefined;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col items-center justify-center rounded-xl border-2 transition-all w-24 h-16 text-center
        ${highlight ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"}
        ${onClick ? "hover:border-green-400 cursor-pointer" : "cursor-default"}
      `}
    >
      {team ? (
        <>
          <span className="text-2xl">{team.flag}</span>
          <span className="text-xs font-medium text-gray-700 truncate w-full px-1">{team.name}</span>
        </>
      ) : (
        <span className="text-xs text-gray-400 px-1">{label}</span>
      )}
    </button>
  );
}

function KnockoutRound({
  title,
  matches,
  picks,
  onPick,
  stage,
}: {
  title: string;
  matches: { slot: string; team1?: string; team2?: string }[];
  picks: Picks;
  onPick: (stage: string, slot: string, teamId: string) => void;
  stage: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="font-bold text-white text-center text-sm">{title}</h3>
      {matches.map((match) => {
        const winner = picks[`${stage}:${match.slot}`];
        const t1 = match.team1 ? getTeam(match.team1) : undefined;
        const t2 = match.team2 ? getTeam(match.team2) : undefined;
        const canPick = !!(t1 && t2);
        return (
          <div key={match.slot} className="flex flex-col items-center gap-1">
            <SlotBox
              label={t1 ? t1.name : "TBD"}
              teamId={match.team1}
              highlight={winner === match.team1}
              onClick={canPick ? () => onPick(stage, match.slot, match.team1!) : undefined}
            />
            <span className="text-white text-xs font-bold">vs</span>
            <SlotBox
              label={t2 ? t2.name : "TBD"}
              teamId={match.team2}
              highlight={winner === match.team2}
              onClick={canPick ? () => onPick(stage, match.slot, match.team2!) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

// Build bracket matchups from picks
// 2026 format: 32 teams advance (top 2 from each of 12 groups + 8 best 3rd place)
// For simplicity we show R16 using group winners/runners in fixed slots
function buildR32Matches(picks: Picks) {
  // Each group produces a winner (1st) and runner-up (2nd)
  // R32 matchup pairs based on FIFA 2026 bracket structure (simplified)
  const bracketPairs: [string, string][] = [
    ["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"],
    ["I", "J"], ["K", "L"], ["A", "C"], ["B", "D"],
    ["E", "G"], ["F", "H"], ["I", "K"], ["J", "L"],
    ["A", "D"], ["B", "C"], ["E", "H"], ["F", "G"],
  ];
  return bracketPairs.map(([g1, g2], i) => ({
    slot: `m${i + 1}`,
    team1: picks[`group:${g1}`] || undefined,
    team2: picks[`runner:${g2}`] || undefined,
  }));
}

function buildR16Matches(r32picks: Picks, r32matches: ReturnType<typeof buildR32Matches>, picks: Picks) {
  const r16: { slot: string; team1?: string; team2?: string }[] = [];
  for (let i = 0; i < 16; i += 2) {
    const m1 = r32matches[i];
    const m2 = r32matches[i + 1];
    r16.push({
      slot: `m${Math.floor(i / 2) + 1}`,
      team1: r32picks[`r32:${m1.slot}`],
      team2: r32picks[`r32:${m2.slot}`],
    });
  }
  return r16;
}

function buildQFMatches(r16matches: { slot: string; team1?: string; team2?: string }[], picks: Picks) {
  const qf: { slot: string; team1?: string; team2?: string }[] = [];
  for (let i = 0; i < 8; i += 2) {
    qf.push({
      slot: `m${Math.floor(i / 2) + 1}`,
      team1: picks[`r16:${r16matches[i]?.slot}`],
      team2: picks[`r16:${r16matches[i + 1]?.slot}`],
    });
  }
  return qf;
}

function buildSFMatches(qfmatches: { slot: string }[], picks: Picks) {
  return [
    { slot: "m1", team1: picks[`qf:${qfmatches[0]?.slot}`], team2: picks[`qf:${qfmatches[1]?.slot}`] },
    { slot: "m2", team1: picks[`qf:${qfmatches[2]?.slot}`], team2: picks[`qf:${qfmatches[3]?.slot}`] },
  ];
}

export default function BracketPage() {
  const [picks, setPicks] = useState<Picks>({});
  const [tab, setTab] = useState<"groups" | "bracket">("groups");
  const [userName, setUserName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    const name = localStorage.getItem("wc_name");
    if (!token) { router.replace("/"); return; }
    setUserName(name || "");

    fetch("/api/picks", { headers: { "x-session-token": token } })
      .then((r) => r.json())
      .then((data: { stage: string; slot: string; team_id: string }[]) => {
        if (Array.isArray(data)) {
          const loaded: Picks = {};
          data.forEach(({ stage, slot, team_id }) => { loaded[`${stage}:${slot}`] = team_id; });
          setPicks(loaded);
        }
      });
  }, [router]);

  const savePick = useCallback(async (stage: string, slot: string, teamId: string) => {
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": token },
      body: JSON.stringify({ stage, slot, teamId }),
    });
  }, []);

  function handlePick(stage: string, slot: string, teamId: string) {
    setPicks((prev) => {
      const key = `${stage}:${slot}`;
      if (!teamId) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: teamId };
    });
    if (teamId) savePick(stage, slot, teamId);
  }

  async function saveAll() {
    setSaving(true);
    const token = localStorage.getItem("wc_token");
    if (!token) return;
    try {
      await Promise.all(
        Object.entries(picks).map(([key, teamId]) => {
          const [stage, slot] = key.split(":");
          return fetch("/api/picks", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-session-token": token },
            body: JSON.stringify({ stage, slot, teamId }),
          });
        })
      );
      setSaveMsg("All picks saved! ✓");
      setTimeout(() => setSaveMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  const r32matches = buildR32Matches(picks);
  const r16matches = buildR16Matches(picks, r32matches, picks);
  const qfmatches = buildQFMatches(r16matches, picks);
  const sfmatches = buildSFMatches(qfmatches, picks);
  const finalMatch = {
    slot: "m1",
    team1: picks[`sf:${sfmatches[0]?.slot}`],
    team2: picks[`sf:${sfmatches[1]?.slot}`],
  };
  const champion = picks["final:m1"];
  const championTeam = champion ? getTeam(champion) : undefined;

  const groupPickCount = GROUPS.filter((g) => picks[`group:${g.id}`]).length;

  function signOut() {
    localStorage.removeItem("wc_token");
    localStorage.removeItem("wc_name");
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-green-900">
      {/* Header */}
      <header className="bg-green-800 border-b border-green-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="text-white font-bold text-lg">🏆 WC 2026</span>
          {userName && <span className="text-green-300 text-sm ml-2">— {userName}</span>}
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && <span className="text-green-300 text-sm">{saveMsg}</span>}
          <button
            onClick={saveAll}
            disabled={saving}
            className="bg-green-600 hover:bg-green-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            {saving ? "Saving…" : "Save All"}
          </button>
          <button onClick={signOut} className="text-green-400 hover:text-white text-sm transition-colors">
            Sign out
          </button>
        </div>
      </header>

      {/* Champion banner */}
      {championTeam && (
        <div className="bg-yellow-400 text-yellow-900 text-center py-2 font-bold flex items-center justify-center gap-2">
          <span>🥇 Your champion pick:</span>
          <span>{championTeam.flag}</span>
          <span>{championTeam.name}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-green-700 bg-green-800 px-4">
        <button
          onClick={() => setTab("groups")}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === "groups" ? "border-white text-white" : "border-transparent text-green-300 hover:text-white"
          }`}
        >
          Groups ({groupPickCount}/12)
        </button>
        <button
          onClick={() => setTab("bracket")}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === "bracket" ? "border-white text-white" : "border-transparent text-green-300 hover:text-white"
          }`}
        >
          Knockout Bracket
        </button>
      </div>

      {/* Groups tab */}
      {tab === "groups" && (
        <div className="p-4 max-w-5xl mx-auto">
          <p className="text-green-300 text-sm mb-4 text-center">
            Click a team to pick them as group winner. Use "2nd" to pick the runner-up.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GROUPS.map((group) => (
              <GroupCard key={group.id} group={group} picks={picks} onPick={handlePick} />
            ))}
          </div>
        </div>
      )}

      {/* Bracket tab */}
      {tab === "bracket" && (
        <div className="p-4 overflow-x-auto">
          <p className="text-green-300 text-sm mb-4 text-center">
            Pick group winners first, then click teams here to advance them through the bracket.
          </p>
          <div className="flex gap-6 items-start min-w-max mx-auto pb-4">
            <KnockoutRound title="Round of 32" matches={r32matches.slice(0, 8)} picks={picks} onPick={handlePick} stage="r32" />
            <KnockoutRound title="Round of 16" matches={r16matches.slice(0, 4)} picks={picks} onPick={handlePick} stage="r16" />
            <KnockoutRound title="Quarters" matches={qfmatches.slice(0, 2)} picks={picks} onPick={handlePick} stage="qf" />
            <KnockoutRound title="Semis" matches={[sfmatches[0]]} picks={picks} onPick={handlePick} stage="sf" />
            <div className="flex flex-col items-center gap-4">
              <h3 className="font-bold text-yellow-400 text-center text-sm">🏆 Final</h3>
              {[finalMatch].map((match) => {
                const t1 = match.team1 ? getTeam(match.team1) : undefined;
                const t2 = match.team2 ? getTeam(match.team2) : undefined;
                const canPick = !!(t1 && t2);
                return (
                  <div key="final" className="flex flex-col items-center gap-1">
                    <SlotBox
                      label={t1 ? t1.name : "TBD"}
                      teamId={match.team1}
                      highlight={champion === match.team1}
                      onClick={canPick ? () => handlePick("final", "m1", match.team1!) : undefined}
                    />
                    <span className="text-white text-xs font-bold">vs</span>
                    <SlotBox
                      label={t2 ? t2.name : "TBD"}
                      teamId={match.team2}
                      highlight={champion === match.team2}
                      onClick={canPick ? () => handlePick("final", "m1", match.team2!) : undefined}
                    />
                    {champion && (
                      <div className="mt-2 text-center">
                        <div className="text-4xl">{getTeam(champion)?.flag}</div>
                        <div className="text-yellow-400 font-bold text-xs">CHAMPION</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <KnockoutRound title="Semis" matches={[sfmatches[1]]} picks={picks} onPick={handlePick} stage="sf" />
            <KnockoutRound title="Quarters" matches={qfmatches.slice(2)} picks={picks} onPick={handlePick} stage="qf" />
            <KnockoutRound title="Round of 16" matches={r16matches.slice(4)} picks={picks} onPick={handlePick} stage="r16" />
            <KnockoutRound title="Round of 32" matches={r32matches.slice(8)} picks={picks} onPick={handlePick} stage="r32" />
          </div>
        </div>
      )}
    </div>
  );
}
