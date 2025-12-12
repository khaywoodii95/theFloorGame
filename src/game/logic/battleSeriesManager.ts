import type { LastTwoSeriesState, PlayerState } from "../types";

type SeriesResult = {
  championId?: number;
  defeatedId?: number;
  status: string;
  hint: string;
};

export class BattleSeriesManager {
  private series: (LastTwoSeriesState & {
    stage: "defender" | "challenger" | "random";
    challengerId: number | null;
    defenderId: number | null;
  }) | null = null;
  private pickRandomCategory: (exclude?: string[]) => string;
  private playedCategories: Set<string> = new Set();

  constructor(pickRandomCategory: (exclude?: string[]) => string) {
    this.pickRandomCategory = pickRandomCategory;
  }

  reset() {
    this.series = null;
    this.playedCategories.clear();
  }

  isActive(): boolean {
    return !!this.series;
  }

  ensureSeries(aliveIds: number[]) {
    if (aliveIds.length !== 2) return;
    const [a, b] = aliveIds as [number, number];
    if (this.series && this.series.players.includes(a) && this.series.players.includes(b)) {
      return;
    }
    this.series = {
      players: [a, b],
      scores: { [a]: 0, [b]: 0 },
      nextCategory: "defender",
      stage: "defender",
      challengerId: null,
      defenderId: null,
    };
  }

  getNextRoundPlan(
    players: Map<number, PlayerState>
  ): { attackerId: number; defenderId: number; category: string; stage: "defender" | "challenger" | "random" } | null {
    if (!this.series) return null;
    if (this.series.players.length !== 2) return null;

    // choose challenger/defender order once at the start
    if (this.series.challengerId === null || this.series.defenderId === null) {
      const [p1, p2] = this.series.players;
      if (Math.random() < 0.5) {
        this.series.challengerId = p1;
        this.series.defenderId = p2;
      } else {
        this.series.challengerId = p2;
        this.series.defenderId = p1;
      }
    }

    const challengerId = this.series.challengerId!;
    const defenderId = this.series.defenderId!;
    const challenger = players.get(challengerId);
    const defender = players.get(defenderId);

    let attackerId = challengerId;
    let defId = defenderId;
    let category = defender?.category ?? "Category";

    if (this.series.stage === "defender") {
      category = defender?.category ?? "Category";
      // next stage: challenger acts as attacker in round 2
      this.series.stage = "challenger";
    } else if (this.series.stage === "challenger") {
      // swap roles for fairness
      attackerId = defenderId;
      defId = challengerId;
      category = challenger?.category ?? "Category";
      // next stage: random decider
      this.series.stage = "random";
    } else {
      // random final round: random who starts and random category not owned by either
      if (Math.random() < 0.5) {
        attackerId = challengerId;
        defId = defenderId;
      } else {
        attackerId = defenderId;
        defId = challengerId;
      }
      const excludeSet = new Set<string>(this.playedCategories);
      if (challenger?.category) excludeSet.add(challenger.category);
      if (defender?.category) excludeSet.add(defender.category);
      category = this.pickRandomCategory(Array.from(excludeSet));
    }

    return { attackerId, defenderId: defId, category, stage: this.series.stage };
  }

  handleResult(winner: PlayerState, loser: PlayerState): SeriesResult | null {
    if (!this.series) return null;

    this.series.scores[winner.id] = (this.series.scores[winner.id] ?? 0) + 1;
    const winnerScore = this.series.scores[winner.id];
    const loserScore = this.series.scores[loser.id] ?? 0;

    if (winnerScore >= 2) {
      const result: SeriesResult = {
        championId: winner.id,
        defeatedId: loser.id,
        status: `${winner.name} wins the best-of-3 and the floor!`,
        hint: "Reset the scene to play again.",
      };
      this.series = null;
      return result;
    }

    const nextStage = this.series.stage;
    const hintStage =
      nextStage === "challenger"
        ? "challenger"
        : nextStage === "random"
        ? "random neutral"
        : "defender";

    return {
      status: `${winner.name} wins this round. Series score ${winnerScore}-${loserScore}.`,
      hint: `Next battle uses the ${hintStage} category. Press Start Next Round to continue.`,
    };
  }

  recordCategoryPlayed(category: string) {
    if (!category) return;
    this.playedCategories.add(category);
  }
}
