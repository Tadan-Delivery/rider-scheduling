/**
 * This is a wrapper over the
 * {@link https://developers.google.com/apps-script/reference/optimization/linear-optimization-service | LinearOptimizationService}
 * provided by the Google Apps Script environment. It provides a simple
 * abstraction for a (mixed-integer) linear program solver.
 */
 namespace lp {
  /**
   * A linear expression over mixed-integer variables.
   *
   * @typeParam T - The type of the auxiliary payload of the variables.
   */
  export class LinExpr<T> {
    private readonly keys: Record<string, Var<T>> = {};
    private readonly values: Record<string, number> = {};

    /**
     * Check if a variable matches the one with the same name in the expression.
     *
     * @throws If the expression contains another variable with the same name.
     */
    private checkVar(v: Var<T>): void {
      if (this.keys[v.name] && this.keys[v.name] !== v) {
        throw new Error(`Mismatching variable named ${v.name}`);
      }
    }

    /**
     * Set the coefficient of a `(coeff * var)` term of the expression.
     *
     * @param v - The variable that identifies the term.
     * @param n - The new coefficient.
     */
    setCoefficient(v: Var<T>, n: number): void {
      this.checkVar(v);
      this.keys[v.name] = v;
      this.values[v.name] = n;
    }

    /**
     * Get the coefficient of a `(coeff * var)` term of the expression.
     *
     * @param v - The variable that identifies the term.
     * @returns The coefficient of the term (or `undefined` if the expression
     * does not contain a term with variable `v`).
     */
    getCoefficient(v: Var<T>): number | undefined {
      this.checkVar(v);
      return this.values[v.name];
    }

    /**
     * Get the terms the expression.
     *
     * @returns All of the `(coeff * var)` terms of the expression, represented
     * as an array of pairs `[var, coeff]`.
     */
    getVarCoefficients(): ReadonlyArray<readonly [Var<T>, number]> {
      return Object.keys(this.keys).map((name) => [this.keys[name], this.values[name]] as const);
    }

    /**
     * Get a string representation of the expression.
     *
     * @remarks This representation is compatible with the
     * {@link https://web.mit.edu/lpsolve/doc/lp-format.htm | LP file format}.
     *
     * @returns The expression, as a string.
     */
    toString(): string {
      return this.getVarCoefficients()
        .map(([v, c], i) => {
          const join = i ? '+ ' : '';
          const sign = c < 0 ? '- ' : join;
          const abs = Math.abs(c);
          const coeff = abs === 1 ? '' : `${abs} `;
          return `${sign}${coeff}${v.name}`;
        })
        .join(' ');
    }
  }

  /**
   * A linear constraint over mixed-integer variables.
   *
   * A linear constraint over mixed-integer variables, i.e. a linear expression
   * augmented with (optional) lower and upper bounds.
   *
   * @typeParam T - The type of the auxiliary payload of the variables.
   */
  export class Constraint<T> extends LinExpr<T> {
    /**
     * Create a linear constraint.
     *
     * A linear constraint over mixed-integer variables, i.e. a linear
     * expression augmented with (optional) lower and upper bounds.
     *
     * @param name - The name of the constraint (only for display/export).
     * @param lowerBound - The lower bound (`undefined` for no lower bound)
     * @param upperBound - The upper bound (`undefined` for no upper bound)
     */
    constructor(public readonly name: string, public lowerBound?: number, public upperBound?: number) {
      super();
    }

    /**
     * Get a string representation of the constraint.
     *
     * @remarks This representation is compatible with the
     * {@link https://web.mit.edu/lpsolve/doc/lp-format.htm | LP file format}.
     *
     * @returns The constraint, as a string.
     */
    toString(): string {
      let r = super.toString();
      if (this.lowerBound !== undefined) {
        r = `${this.lowerBound} <= ${r}`;
      }
      if (this.upperBound !== undefined) {
        r = `${r} <= ${this.upperBound}`;
      }
      return r;
    }

    /**
     * Get the constraint represented as per
     * {@link https://web.mit.edu/lpsolve/doc/lp-format.htm | LP file format}.
     *
     * @returns The constraint, as a string.
     */
    toLP(): string {
      return this.name ? `${this.name}: ${this}` : `${this}`;
    }
  }

  /**
   * A variable of a linear program, plus some convenience data.
   *
   * @remarks
   *
   * The variable is identified within a linear program based on its name;
   * separate instances with the same name might lead to undefined results (in
   * most cases it will result in an exception).
   *
   * The {@link ls.Var.auxData} field can be used by the consumers of the API as
   * a store of custom data, which is convenient to map back the results after
   * solving the linear program.
   *
   * This class is not exported because it should not be used directly; instead,
   * use {@link ls.RealVar}, {@link ls.IntVar}, or {@link ls.BoolVar}.
   *
   * @typeParam T - The type of the auxiliary payload.
   */
  class Var<T> {
    auxData?: T;

    /**
     * Get whether the domain of the variable is ℝ.
     *
     * @returns `true` if the domain is ℝ, otherwise `false`.
     */
    isReal(): boolean {
      return this.type === 'continuous';
    }

    /**
     * Get whether the domain of the variable is {0, 1}.
     *
     * @returns `true` if the domain is {0, 1}, otherwise `false`.
     */
    isBool(): boolean {
      return !this.isReal() && this.lowerBound === 0 && this.upperBound === 1;
    }

    /**
     * Get whether the domain of the variable is ℕ.
     *
     * @returns `true` if the domain is ℕ, otherwise `false`.
     */
    isInt(): boolean {
      return !this.isReal() && !this.isBool();
    }

    /**
     * Create real-valued variable, within (optional) lower/upper bounds.
     *
     * @param type - The type of the variable (continuous/discrete).
     * @param name - The name of the variable, used to identify it.
     * @param lowerBound - The lower bound (`undefined` for no lower bound)
     * @param upperBound - The upper bound (`undefined` for no upper bound)
     */
    constructor(
      public readonly type: 'continuous' | 'integer',
      public readonly name: string,
      public readonly lowerBound?: number,
      public readonly upperBound?: number,
    ) {}

    /**
     * Get a constraint that enforces the lower/upper bounds for this variable.
     *
     * @returns The `lower <= this <= upper` constraint.
     */
    toConstraint(): Constraint<T> {
      const r = new Constraint<T>(`c[${this.name}]`, this.lowerBound, this.upperBound);
      r.setCoefficient(this, 1);
      return r;
    }
  }

  /**
   * A real-valued variable of a linear program, plus some convenience data.
   *
   * @remarks
   *
   * This is the preferred way to handle real-valued variables, although it is
   * currently just a convenience subclass of {@link ls.Var} type.
   *
   * @typeParam T - The type of the auxiliary payload.
   */
  export class RealVar<T> extends Var<T> {
    /**
     * Create a real-valued variable, within (optional) lower/upper bounds.
     *
     * @param name - The name of the variable.
     * @param lowerBound - The lower bound (`undefined` for no lower bound)
     * @param upperBound - The upper bound (`undefined` for no upper bound)
     */
    constructor(name: string, lowerBound?: number, upperBound?: number) {
      super('continuous', name, lowerBound, upperBound);
    }
  }

  /**
   * An int-valued variable of a linear program, plus some convenience data.
   *
   * @remarks
   *
   * This is the preferred way to handle int-valued variables, although it is
   * currently just a convenience subclass of {@link ls.Var} type.
   *
   * @typeParam T - The type of the auxiliary payload.
   */
  export class IntVar<T> extends Var<T> {
    /**
     * Create a int-valued variable, within (optional) lower/upper bounds.
     *
     * @param name - The name of the variable.
     * @param lowerBound - The lower bound (`undefined` for no lower bound)
     * @param upperBound - The upper bound (`undefined` for no upper bound)
     */
    constructor(name: string, lowerBound?: number, upperBound?: number) {
      super('integer', name, lowerBound, upperBound);
    }
  }

  /**
   * An boolean variable of a linear program, plus some convenience data.
   *
   * @remarks
   *
   * This is the preferred way to handle boolean variables, although it is
   * currently just a convenience subclass of {@link ls.IntVar} type.
   *
   * @typeParam T - The type of the auxiliary payload.
   */
  export class BoolVar<T> extends IntVar<T> {
    /**
     * Create a boolean variable, i.e. a variable whose value is either 0 or 1.
     *
     * @param name - The name of the variable.
     */
    constructor(public readonly name: string) {
      super(name, 0, 1);
    }
  }

  /**
   * Create a new objective expression that includes all known variables.
   *
   * This function creates a new linear expression that
   *
   *  - includes all of the variables in the constraints, and
   *
   *  - whose non-zero terms are identical to those of the objective.
   *
   * The resulting expression has the same value as the original objective
   * regardless of the variable assignment, but it covers all of the variables
   * named in the model.
   *
   * @typeParam T - The type of the auxiliary payload of the variables.
   * @param objective - The objective expression.
   * @param constraints - The constraints.
   * @returns The new linear expression
   */
  function saturate<T>(objective: LinExpr<T>, constraints: Constraint<T>[]): LinExpr<T> {
    const newObjective = new LinExpr<T>();
    for (const constraint of constraints) {
      for (const [v] of constraint.getVarCoefficients()) {
        newObjective.setCoefficient(v, 0);
      }
    }
    for (const [v, coefficient] of objective.getVarCoefficients()) {
      newObjective.setCoefficient(v, coefficient);
    }

    return newObjective;
  }

  /**
   * Solve a linear program by minimizing the objective within the constraints.
   *
   * @remarks
   *
   * This function relies on an external LP solver
   * ({@link https://developers.google.com/apps-script/reference/optimization/linear-optimization-service | LinearOptimizationService}).
   *
   * @typeParam T - The type of the auxiliary payload of the variables.
   * @param objective - The objective expression to be minimized.
   * @param constraints - The constraints of the linear program.
   * @returns The solution, or `undefined` if no solution was found.
   */
  export function minimize<T>(objective: LinExpr<T>, constraints: Constraint<T>[]): LinExpr<T> | undefined {
    const newObjective = saturate(objective, constraints);
    const engine = LinearOptimizationService.createEngine();

    // initialize vars and objective
    for (const [v, objectiveCoefficient] of newObjective.getVarCoefficients()) {
      const type =
        v.type === 'continuous'
          ? LinearOptimizationService.VariableType.CONTINUOUS
          : LinearOptimizationService.VariableType.INTEGER;
      // tslint:disable-next-line: prettier
      engine.addVariable(
        v.name,
        v.lowerBound ?? -Infinity,
        v.upperBound ?? +Infinity,
        type,
        objectiveCoefficient,
      );
    }

    for (const constraint of constraints) {
      // tslint:disable-next-line: prettier
      const c = engine.addConstraint(
        constraint.lowerBound ?? -Infinity,
        constraint.upperBound ?? + Infinity,
      );
      for (const [v, coefficient] of constraint.getVarCoefficients()) {
        c.setCoefficient(v.name, coefficient);
      }
    }

    engine.setMinimization();
    const solution = engine.solve(5 * 60);
    if (!solution.isValid()) {
      return undefined;
    }

    const result = new LinExpr<T>();
    for (const [v] of newObjective.getVarCoefficients()) {
      result.setCoefficient(v, solution.getVariableValue(v.name));
    }
    return result;
  }

  /**
   * Export a linear program in LP format.
   *
   * @remarks
   *
   * This function exports the program in a standard format. It can then be
   * solved with most free and commercial solvers for debugging, benchmarking...
   *
   * @typeParam T - The type of the auxiliary payload of the variables.
   * @param objective - The objective expression to be minimized.
   * @param constraints - The constraints of the linear program.
   * @returns The solution, or `undefined` if no solution was found.
   */
  export function exportAsLP<T>(objective: LinExpr<T>, constraints: Constraint<T>[]) {
    const newObjective = saturate(objective, constraints);
    const vars = newObjective.getVarCoefficients().map(([v]) => v);

    const binVars = vars.filter((v) => v.isBool());
    const intVars = vars.filter((v) => v.isInt());
    const constrainedVars = vars
      .filter((v) => !v.isBool())
      .filter((v) => v.lowerBound !== undefined || v.upperBound !== undefined);

    const c = [...constrainedVars.map((v) => v.toConstraint()), ...constraints];
    let footer = '';
    if (binVars.length) {
      footer += `bin ${binVars.map((v) => v.name).join(', ')};\n`;
    }
    if (intVars.length) {
      footer += `int ${intVars.map((v) => v.name).join(', ')};\n`;
    }

    return `minimize: ${objective};
${c.map((c) => `${c.toLP()};\n`).join('')}
${footer}`;
  }
}
