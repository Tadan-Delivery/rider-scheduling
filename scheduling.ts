/**
 * This module converts a rider scheduling problem into a linear program.
 *
 * The scheduling problem is defined based on several data:
 *
 *  - for each timeslice, its duration (in minutes) and the number of expected
 *    riders for each timeslice (both in general and per-type, i.e. vehicle)
 *
 *  - for each rider, his/her "type" (bicycle/scooter), the availability
 *    (expressed as yes/no for each timeslice) and number of guaranteed hours
 *    (according to the contract)
 *
 *  - a minimum duration of the assigned slots.
 *
 * @privateRemarks
 *
 * The following is the (math-oriented) description of the problem. The
 * variables are indexed with names that are easy to associate with their
 * meaning.
 *
 *  - `rider` is the index of a rider, from 0 (included) to `numRiders`
 *    (excluded)
 *
 *  - `type` is the type of a rider (in practice, the vehicle `bike`/`scooter)
 *
 *  - `t` indicates a timeslice, from 0 (included) to `numTimeSlices` (excluded)
 *
 *  - `t1..t2` is a range from `t1` to `t2` (each being a timeslice index from 0
 *    included to `numRiders` excluded); note that although each of `t1` and
 *    `t2` is conceptually an index, they are handled as a pair in this context
 *    to express a range of (multiple consecutive) timeslices
 *
 * Input:
 *
 *  - duration[t] ∈ ℝ is the duration of the timespan `t`
 *
 *  - expected[t] ∈ ℕ is the number of riders expected to be assigned to
 *    timespan `t`
 *
 *  - expectedOfType[type][t] ∈ ℕ is the number of riders of type `type`
 *    expected to be assigned to timespan `t`
 *
 *  - riderType[rider] ∈ { 'scooter', 'bike' } is the type of `rider`
 *
 *  - available[t][rider] ∈ { 0, 1 } is 1 if `rider` is available for the
 *    timeslice `t`, otherwise it is 0
 *
 *  - guaranteed[rider] ∈ ℝ is the duration that is guaranteed to be paid to the
 *    rider
 *
 *  - minDuration ∈ ℝ is the minimum duration of a range `t1..t2`; the system
 *    will not assign shorter ranges.
 *
 * There are several sanity assumptions on the input values; note that they are
 * not needed as constraint in the LP instance (if they are not respected, the
 * problem is likely meaningless).
 *
 * ```
 * ∀ t. 0 <= duration[t]
 * ∀ t. 0 <= expected[t] <= numRiders
 * ∀ rider. 0 <= guaranteed[rider]
 * 0 <= minDuration
 * ```
 *
 * Under these assumptions, the problem is encoded as follows:
 *
 *  - the `a[rider][t1..t2]` variable represents whether the `t1..t2` range has
 *    been assigned to `rider` (`a` has been chosen as the first letter of
 *    "Assigned"); it is a boolean variable, i.e. its value can only be 0 or 1.
 * ```
 * ∀ rider, t1..t1. assigned[rider][t1..t2] ∈ { 0, 1 }
 * ```
 *
 *  - the `time[rider]` variable represents how much time must be counted for
 *    `rider`; regardless of assignments, at least the guaranteed time must be
 *    counted, hence the variable has a lower bound of `guaranteed[rider]`:
 * ```
 * ∀ rider. guaranteed[rider] <= time[rider]
 * ```
 *
 *  - the `timeCounted` constraint states that for each rider, count the total
 *    duration of the time ranges that have been assigned:
 * ```
 * ∀ rider. ∑ (∑_{t ∈ t1..t2} duration[t]) * assigned[rider][t1..t2] <= time[rider]
 * ```
 *
 *  - the `disjointAllocations` constraint states that each rider can only be
 *    assigned to one of the overlapping time ranges:
 * ```
 * ∀ rider, t. ∑_{t ∈ t1..t2} assigned[rider][t1..t2] <= available[t][rider]
 * ```
 *
 *  - the `enough` constraint states that each timeslice has been assigned
 *    enough riders to satisfy the expected count:
 * ```
 * ∀ t. expected[t] <= ∑_{rider, t ∈ t1..t2} a[rider][t1..t2]
 * ```
 *
 *  - the `enough[type]` constraint states the same, but restricted to a given
 *    `type`:
 * ```
 * ∀ t. expectedOfType[type][t] <= ∑_{riderType[rider] = type, t ∈ t1..t2} a[rider][t1..t2]
 * ```
 *
 * The objective function handles multiple components:
 *
 *  - it tries to avoid overallocations
 *
 *  - it favours assigning contiguous time ranges
 *
 * this is achieved by minimizing
 *
 * ```
 * k * (∑_{rider} time[rider]) + (∑_{rider, t ∈ t1..t2} a[rider][t1..t2])
 * ```
 *
 * with a `k` coefficient that is bigger than the total amount of possible assignments.
 *
 */
namespace scheduling {
  interface AuxData {
    rider: number;
    t1: number;
    t2: number;
  }

  function assert(condition: any, msg?: string): asserts condition {
    if (!condition) {
      throw new Error(msg);
    }
  }

  function append<T>(dest: T[], source: ReadonlyArray<T | undefined>) {
    for (const x of source) {
      if (x) {
        dest.push(x);
      }
    }
  }

  function makeRecord<V>(keys: string[], f: (key: string) => V) {
    const r: Record<string, V> = {};
    for (const key of keys) {
      r[key] = f(key);
    }
    return r;
  }

  /**
   * Construct a linear program that solves the given scheduling problem.
   *
   * @param duration - The array of durations of the input timeslices.
   * @param expected - The array of expected number of riders in each timeslice.
   * @param expectedOfType - The array of expected number of riders in each
   * timeslice, for each type.
   * @param riderType - The type of each rider.
   * @param available - For each timeslice, whether the rider is available.
   * @param guaranteed - For each rider, the guaranteed amount of time.
   * @param minDuration - The minimum duration of an assignable
   * @returns The solution, or `undefined` if no solution was found.
   */
  export function makeLP(
    duration: number[],
    expected: number[],
    expectedOfType: Record<string, number[]>,
    riderType: string[],
    available: boolean[][],
    guaranteed: number[],
    minDuration: number,
  ) {
    const numRiders = guaranteed.length;
    const numTimeSlices = expected.length;

    const types = Object.keys(expectedOfType);

    // check that the input shapes are consistent
    assert(duration.length === numTimeSlices);
    assert(expected.length === numTimeSlices);
    assert(types.every((type) => expectedOfType[type].length === numTimeSlices));
    assert(riderType.length === numRiders);
    assert(available.length === numTimeSlices);
    assert(available.every((a) => a.length === numRiders));
    assert(guaranteed.length === numRiders);
    assert(duration.every((d) => 0 <= d));
    assert(expected.every((count) => 0 <= count && count <= numRiders));
    assert(riderType.every((type) => expectedOfType[type]));

    const objective = new lp.LinExpr<AuxData>();

    const timeCounted = guaranteed.map((_, rider) => new lp.Constraint<AuxData>(`timeCounted[${rider}]`, 0));
    const haveEnoughRiders = expected.map((count, t) =>
      count ? new lp.Constraint<AuxData>(`enough[${t}]`, count) : undefined,
    );
    const haveEnoughRidersOfType = makeRecord(types, (type) =>
      expectedOfType[type].map((count, t) =>
        count ? new lp.Constraint<AuxData>(`enough[${type}][${t}]`, count) : undefined,
      ),
    );
    const disjointAllocations = guaranteed.map((_, rider) =>
      expected.map((_, t) =>
        available[t][rider] ? new lp.Constraint<AuxData>(`disjoint[${rider}][${t}]`, undefined, 1) : undefined,
      ),
    );

    let timeCoefficient = 0;

    for (let rider = 0; rider < numRiders; rider += 1) {
      for (let t1 = 0; t1 < numTimeSlices; t1 += 1) {
        let d = 0;
        for (let t2 = t1; t2 < numTimeSlices && available[t2][rider]; t2 += 1) {
          d += duration[t2];
          if (d >= minDuration) {
            const v = new lp.BoolVar<AuxData>(`a[${rider}][${t1}..${t2}]`);
            v.auxData = { rider, t1, t2 };
            objective.setCoefficient(v, 1);
            timeCounted[rider].setCoefficient(v, -d); // timeCounted[rider]: 0 <= time[rider] - sum(durations)
            for (let t = t1; t <= t2; t += 1) {
              haveEnoughRiders[t]?.setCoefficient(v, 1);
              haveEnoughRidersOfType[riderType[rider]][t]?.setCoefficient(v, 1);
              disjointAllocations[rider][t]?.setCoefficient(v, 1);
            }
            timeCoefficient += 1;
          }
        }
      }
    }

    for (let rider = 0; rider < numRiders; rider += 1) {
      const v = new lp.RealVar<AuxData>(`time[${rider}]`, guaranteed[rider]); // guaranteed[rider] <= time[rider]
      objective.setCoefficient(v, timeCoefficient);
      timeCounted[rider].setCoefficient(v, 1); // timeCounted[rider]: 0 <= time[rider] - sum(durations)
    }

    const constraints = [...timeCounted];
    append(constraints, haveEnoughRiders);
    types.forEach((type) => append(constraints, haveEnoughRidersOfType[type]));
    disjointAllocations.forEach((a) => append(constraints, a));

    const solve = () => {
      const solution = lp.minimize(objective, constraints);
      if (!solution) {
        return undefined;
      }

      const assignment = guaranteed.map(() => expected.map(() => false));
      for (const [v, c] of solution.getVarCoefficients()) {
        if (v.auxData && c > 0.5) {
          const { rider, t1, t2 } = v.auxData;
          for (let t = t1; t <= t2; t += 1) {
            assignment[rider][t] = true;
          }
        }
      }

      return assignment;
    };

    return {
      solve,
      export: () => lp.exportAsLP(objective, constraints),
    };
  }
}
