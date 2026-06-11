# Quantifying Ordered Relationships

**Distinguishing Template Topology from Variable Noise**

-----

## 1. The Core Problem: Decoys and The "Gap"
When mining templates, we rely on repeated substrings to form the vocabulary. However, repetition is not unique to the template structure.

* **Structural Anchors**: Invoice No:, Total Due:, \n----------------\n (These define the template).
* **Variable Decoys**: Common terms inside slots (e.g., USD, Inc., Unit) or recurring data values (e.g., a specific date appearing in multiple records).

**The Challenge**: A naive adjacency check (Markov) might mistakenly link Invoice No: to USD because USD appears frequently in the slot. We need mechanisms that look past the variable noise—ignoring the decoys—to find the next true structural anchor (Total Due:), determining that USD is merely content within the gap.

-----

## 2. Discrete Approaches (Hard Constraints)

These methods look for sequences of items, allowing for "jumps" over noise, but use binary logic (match/no-match).

### Sequential Pattern Mining (SPM)

Originated for "Market Basket Analysis" (e.g., customers who buy A, then later B).

* **Concept**: Identifying ordered subsequences (A -> B -> C) that appear frequently, even if separated by other data (decoys).
* **Key Logic**:
  * **Support**: The pattern must appear N times.
  * **MaxGap**: The critical filter. "B must follow A within N characters." This constraint forces the algorithm to bridge the gap (the slot) to find the next anchor.
* **Algorithms**:
  * **PrefixSpan**: A projection-based algorithm that efficiently finds these "broken" sequences without generating every candidate.
  * **GSP (Generalized Sequential Patterns)**: An earlier, iterative approach.
* **Role in Templates**: SPM is excellent for generating Candidate Skeletons by ignoring the specific content of the slots.

-----

## 3. Continuous Approaches (Probabilistic Weights)

These methods treat relationships as fields of influence. They solve the "Decoy" problem by scoring consistency. Decoys (like USD) might appear at random distances, whereas true anchors (Total Due:) often appear at consistent distances relative to the previous anchor.

### The "Tends to Follow Closely" Score

* **Concept**: Pattern A is an event that casts a "shadow" of probability forward. Pattern B scores points based on how closely it follows A.
* **Mechanism**: Distance Decay.
  * Instead of `If Gap < 50 then Match` (SPM),
  * We use `Score = 1 / Gap` or `Score = e ^ -Gap`.
* **Theoretical Basis**:
  * **Hawkes Processes**: Models "self-exciting" events. The appearance of a header "excites" the probability of a footer appearing shortly after.
  * **Signal Cross-Correlation**: If we view A and B as signals, a sharp spike in correlation at a specific lag indicates a structural relationship. A "smeared" correlation indicates variable noise.

-----

## 4. Synthesis: A Robust Pipeline

To effectively mine templates amidst noise and decoys:

* **Identify Vocabulary**: Find repeated substrings (Frequency Analysis).
* **Filter Decoys (SPM)**: Use Sequential Pattern Mining (PrefixSpan) with a MaxGap constraint to find recurring sequences of these substrings, ignoring the variable data in between.
* **Score Topology (Follow Score)**: Apply Distance Decay to these sequences.
  * **High/Sharp Score**: Rigid Template Structure (e.g., Table Headers).
  * **Low/Smeared Score**: Loose Association (e.g., a Footer that appears strictly at the bottom of a variable-length page).
