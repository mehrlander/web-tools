# Template Discovery

### The Problem
Text often contains internally repeated structures (e.g., log entries, data lists, code blocks). We want to programmatically identify these implicit templates.

### First Observations
1.  **Structure:** A template is composed of an ordered sequence of **literals** interleaved with **variables** that represent an arbitrary string.
2.  **Recurrence:** Any literal in a template must occur at least twice in the document, and any template must have at least one literal.
3.  **Frequency:** A meaningful template occurs two or more times. Each occurrence is an **instance** of the template.
4.  **Binary Matching:** A template is defined such that a given substring either matches it or does not.
5.  **Zero-Parameter Case:** A literal recurrence of a substring establishes a zero-parameter template.
6.  **Parameterized Case:** Any parameterized template must be composed of at least two recurring substrings (to frame the variable).
7.  **Nesting:** A template may include another template within it.
8.  **Partial Overlap:** If a template partially includes another, substitution of one would break the other.
9.  **Variable Constraints:** A variable represents an arbitrary string, though it may optionally be constrained to match a specific pattern.
