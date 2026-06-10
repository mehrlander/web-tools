Architectural Synthesis of Representational Strategies for Single-Document Template Induction: A Dual-Stream, Minimum Description Length Approach for the Wring Project
1. Introduction and Problem Space Definition
The mandate of the Wring project—to perform single-document template induction—represents a fundamental departure from the prevailing paradigms of information extraction (IE) and log analysis. Contemporary approaches to structure discovery, ranging from industrial log parsers like Drain and Spell to web-scale wrapper induction systems, predominantly operate under the "Law of Large Numbers." They rely on massive, multi-document corpora to statistically distinguish signal from noise, assuming that structural patterns will emerge through frequency while idiosyncratic data fades into the background. In contrast, Wring operates in a data-scarce, high-stakes environment: the extraction of latent schemas from a singular context—a single log file, a unique configuration blob, or a solitary semi-structured report.
This constraint shifts the theoretical objective from statistical inference (learning from a population) to structural compression (learning from a specimen). We are not asking, "What is common across these ten thousand documents?" but rather, "How can this single document be most efficiently described as a function of a generative template T and a parameter set P?" The distinction is critical because it invalidates the heuristic shortcuts employed by stream-processing algorithms. In a single document, a pattern might repeat only twice. A representation that is too coarse (e.g., delimiting by whitespace) risks treating these two instances as distinct due to trivial formatting noise, while a representation that is too fine (e.g., raw bitstreams) expands the search space for templates into intractability.
The central research question governing this report is: What representation—specifically regarding tokenization and typing—best supports template discovery in this restricted context?
To answer this, we must deconstruct the "Representation Gap"—the divergence between how machines store text and how algorithms perceive structure. This report synthesizes a solution based on the intersection of Algorithmic Information Theory, Parameterized Complexity, and Neuro-symbolic Dual-Stream processing. We posit that the optimal representation for Wring is not a static preprocessing step but a dynamic, optimizing search process governed by the Minimum Description Length (MDL) principle. We propose a Dual-Stream Architecture that separates the induction of the structural skeleton (the "dorsal" stream) from the semantic typing of content slots (the "ventral" stream), utilizing Baker-style Parameterized Strings and BlinkFill-style Input Graphs to bridge the gap between character-level fidelity and token-level abstraction.
The following sections provide an exhaustive analysis of the theoretical underpinnings, the mechanics of tokenization, the hierarchy of typing, and the algorithmic structures necessary to support this discovery, culminating in a detailed architectural blueprint for Wring.
2. Theoretical Foundations: Learning as Compression
To rigorously evaluate representational strategies for Wring, we must first establish an objective function that operates without labeled ground truth. In the absence of external supervision, the most robust theoretical framework for structural discovery is the Minimum Description Length (MDL) principle. This principle provides a mathematical unification of "learning" and "compression," asserting that the best explanation for a dataset is the one that permits the most compact representation of that data.
2.1 The Two-Part Code and Stochastic Complexity
The MDL principle, as pioneered by Rissanen and extended by Grünwald, frames the induction problem as the minimization of a two-part code. For a given document D and a hypothesis space of templates \mathcal{H}, we seek the hypothesis H \in \mathcal{H} that minimizes the total description length L(D, H):
In the specific context of Wring's single-document induction:
	•	L(H) (Model Description Length): This term quantifies the complexity of the template itself. It includes the cost of encoding the static structural tokens (the "boilerplate"), the grammatical rules, and the structure of the regexes or types used. A "lazy" template that simply memorizes the document verbatim has a massive L(H) because the model is the data. Conversely, a template that is overly generic (e.g., .*) has a near-zero L(H).
	•	L(D|H) (Data Description Length): This term quantifies the cost of encoding the original document given the template. This effectively measures the "goodness of fit" or the residual entropy. If the template is the document itself, L(D|H) is zero. If the template is .*, L(D|H) remains equal to the raw document size, as the model provides no predictive power to compress the content.
The optimal representation is the one that minimizes this sum, effectively penalizing both overfitting (memorization) and underfitting (over-generalization). For Wring, this implies that the representation must be compressible. A tokenization strategy that results in an alphabet of 10,000 unique "words" makes L(H) expensive (large dictionary cost). A strategy that uses 50 unique "micro-tokens" (e.g., character classes) keeps L(H) low but potentially increases L(D|H) if the grammar is inefficient.
2.2 Refined MDL and the "Wringing" Metaphor
Beyond the crude two-part code, "Refined MDL" introduces the concept of stochastic complexity, which includes a term for "parametric complexity"—a measure of the richness of the model class itself. This is particularly relevant for the "Typing" aspect of Wring. A type like String is extremely rich (it can fit any text), incurring a high parametric cost. A type like Integer[0-100] is restrictive, incurring a low parametric cost.
The project name "Wring" aligns metaphorically with the database compression concept of "wringing a table dry". This literature suggests that optimal compression is achieved not by treating rows as independent entities, but by identifying vertical dependencies (column correlations) and horizontal redundancies (templates). In single-document processing, "wringing" the entropy out of the text requires a representation that exposes these redundancies. If the representation obscures the similarity between User: Alice and User: Bob (e.g., by tokenizing them as distinct atomic hashes), the entropy remains trapped. The representation must factorize the signal into Structure \times Content, allowing the algorithm to compress the structure once and the content separately.
2.3 Parameterized Complexity and Tractability
While MDL provides the objective, Parameterized Complexity theory provides the bounds on computational feasibility. The induction of the optimal grammar is known to be NP-hard (related to the Smallest Grammar Problem). However, if we fix certain parameters—such as the maximum number of variable slots in a template (k) or the alphabet size (\Sigma)—the problem can become Fixed-Parameter Tractable (FPT).
This has direct implications for Wring's representation. A character-level representation implies an infinite or very large effective alphabet for pattern matching, potentially pushing the algorithm out of FPT territory (O(n^k)). A tokenized representation with a typed alphabet constrains the search space, allowing algorithms like Baker's Parameterized Pattern Matching to operate in near-linear time (O(n \log \sigma)). Therefore, the representation serves as a mechanism to enforce the constraints necessary for tractable discovery.
3. Tokenization Architectures: The Granularity Spectrum
Tokenization—the discretization of the continuous text stream into atomic units—is the foundational decision in the Wring architecture. The literature presents a spectrum of approaches, from rigid delimiter-based splitting to fluid character-level modeling. Each represents a trade-off between semantic coherence and structural discoverability.
3.1 The Limitations of Delimiter-Based Tokenization (The "Drain" Paradigm)
The dominant paradigm in log analysis, exemplified by systems like Drain , LKE, and SLCT, utilizes delimiter-based tokenization. These systems split text strings on a pre-defined set of delimiters (typically whitespace, commas, and colons).
	•	Mechanism: A log line 2023-10-12 Error: Connection failed is transformed into the list ["2023-10-12", "Error:", "Connection", "failed"].
	•	Discovery Process: Drain builds a fixed-depth parse tree where each node represents a token at a specific position. It uses heuristics to decide if a token is a constant (matches the node) or a variable (diverges).
	•	Critique for Wring: While computationally efficient (O(N)), this representation is fundamentally brittle for single-document induction.
	1	Format Drift: If a document contains key=value in one section and key = value in another, a delimiter-based tokenizer sees these as structurally distinct (one token vs. three tokens). This forces the induction algorithm to effectively "hallucinate" two different templates, failing to capture the underlying unity of the key/value assignment.
	2	Morphological Opacity: It treats words as atomic units. It cannot perceive that failed, failure, and fail share a common root. In a single document with sparse data, recognizing this morphological overlap is crucial for linking related templates.
	3	Compound Token Blindness: Identifiers such as us-east-1 or server_prod_01 are treated as monolithic atoms. If the document also contains us-west-1, a delimiter-based system sees a mismatch. It cannot "see inside" the token to realize that the structure is Region-Direction-Number. Wring requires a representation that can perform intra-token template induction.
3.2 The "InputDataGraph" Strategy: Micro-Tokenization and Lattices
To overcome the brittleness of delimiters without succumbing to the computational cost of raw characters, the analysis points to a hybrid approach inspired by BlinkFill and Multi-Layer Parsers (ML-Parser). This strategy can be termed Micro-Tokenization or Lattice-Based Representation.
Instead of making a hard decision to split on whitespace, the system constructs an InputDataGraph—a Directed Acyclic Graph (DAG) where nodes represent character boundaries and edges represent valid token interpretations.
	•	Mechanism: For the string pid=123:
	•	One path might be the literal sequence: Edge("p") -> Edge("i") ->...
	•	Another path might use character classes: Edge("Lower", len=3) -> Edge("Symbol") -> Edge("Digit", len=3).
	•	A third path might recognize a known entity: Edge("Identifier") -> Edge("Equals") -> Edge("Integer").
	•	Advantage: This representation defers the tokenization decision. The template induction algorithm is not forced to work with a possibly incorrect split. Instead, it searches for the common path through the graphs of multiple lines that minimizes the description length.
	•	BlinkFill's Contribution: BlinkFill demonstrates that learning transformations on semi-structured data (like spreadsheets or logs) requires learning arbitrary constant string tokens from the data itself. It does not assume a fixed dictionary; it induces that Next Record: is a token because it appears repeatedly as a delimiter.
3.3 Character-Level and Subword Modeling
Deep learning approaches, particularly Large Language Models (LLMs) and systems like CharacterBERT, utilize character-level or subword (Byte Pair Encoding) representations.
	•	Relevance: Snippet indicates that character-level models significantly outperform word-level models in domains with rich morphology (like biomedicine) because they capture inductive biases in suffix/prefix structures. In the context of Wring, a log file is often "morphologically rich" in a technical sense (variable names, error codes).
	•	Constraint: However, pure character-level induction is computationally expensive. Finding the Longest Common Subsequence (LCS), as done in Spell , is quadratic O(N^2). Applying this to an entire document at the character level is prohibitive.
	•	Synthesis: Wring should use character-level analysis selectively. It should employ Micro-Tokenization (splitting on character class boundaries like Letter/Digit/Symbol) as the primary unit. This reduces the sequence length by an order of magnitude compared to raw characters while preserving the ability to model key=value vs key = value as merely the insertion of Space tokens.
Table 1: Comparative Analysis of Tokenization Strategies for Wring
Feature
Standard (Drain/Split)
Character-Level
Micro-Token (Proposed)
Atomic Unit
Word / Delimited String
Byte / Unicode Char
Character Class Block
Granularity
Coarse
Finest
Adaptive
Delimiter Sensitivity
High (Brittle)
None (Robust)
Low (Flexible)
Sequence Length
Short (L)
Long (10L)
Medium (2-3L)
Morphology
Opaque
Transparent
Accessible
Search Space
Small
Huge
Manageable
Best For
High-volume streams
Neural Networks
Single-Doc Induction
4. The Hierarchy of Typing: From Syntax to Semantics
Once the data stream is discretized into tokens, the representation must assign "Types." Typing is the engine of generalization; it is the mechanism that allows the system to assert that 192.168.1.1 and 10.0.0.1 are functionally equivalent instances of the same slot.
4.1 The Functional Morphology Bottleneck
Research in Second Language Acquisition (SLA) proposes the Bottleneck Hypothesis , suggesting that "functional morphology" (grammatical features, structure) is harder to acquire than lexical meaning. Transposing this to template induction: extracting the structural skeleton (the functional morphology of the log) is the bottleneck. The "content" (lexical values) is secondary.
Most systems use Pre-typing, assigning rigid types (e.g., Integer, Date, IP) before induction. This effectively creates a "pidgin" representation where the algorithm is biased by its predefined type system. If the document uses a novel identifier format (e.g., UUIDv4), a pre-typed system sees it as a generic String or noise, failing to recognize it as a consistent structural element.
Recommendation: Wring must adopt a Post-typing strategy. The induction phase should operate on "induced types" or "equivalence classes" derived from the document's internal redundancy, assigning semantic labels (like "IP Address") only after the structure is solidified.
4.2 Baker's Parameterized Strings: The Core Representation
The most critical insight for Wring's typing strategy comes from Brenda Baker's theory of Parameterized Pattern Matching. This work addresses the exact problem of identifying code duplication (or templates) when variable names change.
	•	P-Strings: Baker defines a "parameterized string" (p-string) over two alphabets: \Sigma (static constants) and \Pi (parameters). Two p-strings match if there is a bijective mapping between their parameters.
	•	String A: User X connected to Port P
	•	String B: User Y connected to Port Q
	•	These are a p-match because \{X \to Y, P \to Q\} is a valid bijection.
	•	Prev-Encoding: To make this efficiently discoverable, Baker introduces Prev-Encoding. In this representation, every parameter token is replaced by a pointer (integer) representing the distance to its previous occurrence in the string.
	•	If X has not been seen, it is encoded as 0 (new parameter).
	•	If X was seen 3 tokens ago, it is encoded as 3.
	•	Result: Under prev-encoding, String A and String B become identical sequences. The variable names (X, Y) are abstracted away into structural relationships.
Implication for Wring: This is the "Silver Bullet" for single-document induction. By converting the Micro-Token stream into a Baker-encoded stream (classifying low-frequency tokens as \Pi and high-frequency as \Sigma), Wring can use standard string matching algorithms (Suffix Trees, Sequitur) to find templates. The "Type" of a token in this phase is simply "Parameter" or "Static," distinguishing structure from content.
4.3 The BlinkFill Type System
While Baker handles the structure of variables, BlinkFill provides the framework for semantics. BlinkFill does not just use String; it induces types based on shared properties.
	•	InputDataGraph Types: It recognizes types like ProperCase, CAPS, Digits, and crucially, context-dependent constants.
	•	Application: After Baker's algorithm identifies a slot, Wring can use BlinkFill's logic to describe that slot. If the slot always contains [A-Z]{3}-\d{3}, that Regex becomes the induced type.
5. Algorithmic Mechanisms for Discovery
The representation must support specific algorithms. We evaluate three primary families found in the research: Drain (Tree), Spell (LCS), and Sequitur (Grammar).
5.1 The Failure of Fixed-Depth Trees (Drain)
Drain is the industry standard for speed. It uses a Parse Tree where the root is the first token, the next layer is the second token, etc.
	•	Fatal Flaw: It assumes positionality is rigid. If a log template has an optional word (User [successfully] logged in), the tree branches diverge, and Drain learns two separate templates. In a single document, this fragmentation prevents the system from realizing that "successfully" is just a parameter of the event.
	•	**Snippet ** (ML-Parser) confirms that fixed-depth trees struggle with variable-length logs and suggests a multi-layer approach.
5.2 The Computational Cost of LCS (Spell)
Spell uses the Longest Common Subsequence algorithm.
	•	Mechanism: It compares a new line to existing templates using LCS. If similarity > threshold, it merges them (replacing differences with *).
	•	Critique: LCS is robust but computationally heavy (O(N^2)). More importantly, it is greedy. The order in which lines are processed changes the resulting templates. In single-document induction, where we have the whole document available, greedy streaming algorithms are sub-optimal compared to global optimization.
5.3 Hierarchical Grammar Induction (Sequitur)
Sequitur offers the most promising algorithmic match for Wring. It is a linear-time algorithm that builds a Context-Free Grammar (CFG) from a sequence.
	•	Mechanism: It enforces two constraints:
	1	Digram Uniqueness: No pair of symbols appears twice in the grammar (if they do, a new rule is created).
	2	Rule Utility: Every rule is used more than once.
	•	Representation Synergy: If we feed Baker-Encoded Micro-Tokens into Sequitur, the algorithm naturally performs hierarchical template induction.
	•	It will identify \d{2}:\d{2}:\d{2} (encoded) as a recurring unit and create a rule Timestamp.
	•	It will identify User <param> logged in as a recurring unit and create a rule LoginEvent.
	•	MDL Alignment: Sequitur is effectively a greedy approximation of the MDL principle. It compresses the string by extracting structure. Research snippet even describes applying Sequitur to "intrusion masquerade detection" by building user-specific grammars—a direct parallel to Wring's single-document goal.
5.4 Joint Learning of Templates and Slots
Research on Joint Learning suggests that template detection and slot extraction should not be separate phases. The identification of a template (User X logged in) and the identification of a slot (X is an entity) are mutually reinforcing.
	•	Mechanism: Using the Dual-Stream model (elaborated below), Wring can iteratively refine the representation. If a proposed slot consistently matches a specific Regex (e.g., IP Address), that strengthens the hypothesis that the surrounding text is a stable template.
6. The Dual-Stream Architecture Proposal
Synthesizing the "functional morphology" of linguistics , the "dual stream" model of neuroscience , and the "parameterized matching" of algorithmic theory , we propose a Dual-Stream Representation Architecture for Wring.
This architecture processes the document through two parallel but interacting streams: the Structural Stream (Dorsal) and the Content Stream (Ventral).
6.1 Stream 1: The Dorsal (Structure) Stream
	•	Function: Discovery of the template "skeleton" and navigational structure. "Where is the information?"
	•	Representation: Baker-Encoded Micro-Tokens.
	•	Tokenization: Split on character class boundaries.
	•	Normalization: Replace all tokens identified as potential parameters (high entropy, low frequency) with a Prev-Pointer (distance to last occurrence) or a generic Param placeholder.
	•	Objective: Maximize compression of the sequence.
	•	Algorithm: Sequitur (Grammar Induction) or Parameterized Suffix Tree.
	•	Output: A Context-Free Grammar where the root rules correspond to the document's templates.
6.2 Stream 2: The Ventral (Content) Stream
	•	Function: Analysis of the semantic identity of the slots. "What is the information?"
	•	Representation: Raw Character Lattices mapped to the slots identified by the Dorsal stream.
	•	Algorithm: BlinkFill-style Regular Expression Learning.
	•	For every slot in a template, collect all observed values.
	•	Induce the minimal Regex that describes this set (e.g., [0-9]{3}-[0-9]{2}).
	•	Output: Semantic constraints and types for the extracted parameters.
6.3 Interaction and Feedback
The two streams interact via an MDL Scoring Function.
	•	If the Dorsal stream proposes merging two lines into a template, but the Ventral stream finds that the parameters in a specific slot have incompatible types (e.g., merging a Date with an Error Code), the merge is penalized.
	•	This prevents the "over-generalization" common in log parsers where distinct event types are mashed together because they share a few common words.
Table 2: The Dual-Stream Architecture vs. Traditional Approaches
Component
Traditional Log Parsing (Drain/Spell)
Wring Dual-Stream (Proposed)
Tokenization
Delimiter-based (Words)
Micro-Tokens (Char Classes)
Variable Handling
Heuristic (is_digit?)
Baker's Prev-Encoding (Structural)
Typing
Pre-defined (Fixed list)
Induced (Post-typing via Regex)
Induction
Greedy Clustering
Grammar Compression (Sequitur/MDL)
Objective
Similarity Threshold
Minimum Description Length
Granularity
Single (Word)
Dual (Structure + Content)
7. Implications and Future Outlook
7.1 "Wringing" as Entropy Reduction
The proposed architecture aligns with the project's evocative name. By utilizing Sequitur on Baker-encoded tokens, the system literally "wrings" redundancy out of the file. The "Template" becomes the dictionary of the compression algorithm, and the "Data" becomes the sequence of dictionary indices. This provides a rigorous mathematical guarantee: the best template is the one that compresses the single document most effectively.
7.2 Robustness via Granularity
The Micro-Tokenization strategy ensures robustness against "Format Drift." Because the system does not commit to "words," it is immune to changes in delimiter style (e.g., key:val vs key : val). These are simply different sequences of micro-tokens that the grammar will learn to handle as variants of the same higher-level rule.
7.3 The FPT Advantage
By utilizing Parameterized Complexity concepts (specifically Baker's algorithms), Wring ensures that the induction remains tractable even for large single documents. The "Prev-Encoding" transforms the infinite vocabulary of parameters into a finite alphabet of "distances," allowing linear-time algorithms to operate where O(N^2) clustering would typically be required.
8. Conclusion
To effectively solve the problem of single-document template induction, Wring must abandon the coarse, delimiter-based representations of traditional log parsers. The analysis confirms that a Dual-Stream Representation is optimal. This architecture utilizes Micro-Tokenization to preserve morphological fidelity and Baker's Prev-Encoding to abstract away variable renaming, processing the resulting stream through a Grammar Induction engine (Sequitur) guided by Minimum Description Length. This approach separates the concerns of structural discovery and content typing, allowing Wring to achieve high-fidelity extraction without reliance on large training corpora, effectively treating "learning" as the ultimate form of data compression.
Citations:
Works cited
1. Minimum description length - Wikipedia, https://en.wikipedia.org/wiki/Minimum_description_length 2. A Tutorial Introduction to the Minimum Description Length ... - CWI, https://homepages.cwi.nl/~pdg/ftp/mdlintro.pdf 3. RCDi: Robust Causal Direction Inference Using INUS-Inspired Asymmetry with the Solomonoff Prior - MDPI, https://www.mdpi.com/2227-7390/13/3/544 4. Squish: Near-Optimal Compression for Archival of Relational Datasets - PMC - NIH, https://pmc.ncbi.nlm.nih.gov/articles/PMC5293150/ 5. Proceedings of the 32nd Annual Fall Workshop on Computational Geometry (FWCG 25), https://www.cs.qc.cuny.edu/goswami/Proceedings-FWCG_25.pdf 6. PARAMETERIZING FROM THE EXTREMES: FEASIBLE PARAMETERIZATIONS OF SOME NP-OPTIMIZATION PROBLEMS - TCS RWTH, https://tcs.rwth-aachen.de/users/sikdar/index_files/somnath_thesis.pdf 7. The Bidimensionality Theory and Its Algorithmic Applications - ResearchGate, https://www.researchgate.net/publication/220459472_The_Bidimensionality_Theory_and_Its_Algorithmic_Applications 8. Approximate Parameterized Matching, https://u.cs.biu.ac.il/~amiram/PMslides/parameterized94.ppt 9. Drain: An Online Log Parsing Approach with Fixed Depth Tree - ResearchGate, https://www.researchgate.net/publication/319640282_Drain_An_Online_Log_Parsing_Approach_with_Fixed_Depth_Tree 10. logpai/Drain3: A robust streaming log template miner based on the Drain algorithm - GitHub, https://github.com/logpai/Drain3 11. Drain: An Online Log Parsing Approach with Fixed Depth Tree - Jieming Zhu, https://jiemingzhu.github.io/pub/pjhe_icws2017.pdf 12. ML-Parser: An Efficient and Accurate Online Log Parser - JCST, https://jcst.ict.ac.cn/fileup/1000-9000/PDF/2022-6-11-0730.pdf 13. An Information Extraction Study: Take In Mind the Tokenization! - ResearchGate, https://www.researchgate.net/publication/369557452_An_Information_Extraction_Study_Take_In_Mind_the_Tokenization 14. BlinkFill: Semi-supervised Programming By Example for Syntactic ..., http://www.vldb.org/pvldb/vol9/p816-singh.pdf 15. Exploring the impact of fixed theta values in RoPE on character-level language model performance and efficiency - Frontiers, https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2025.1626899/pdf 16. Spell: Online Streaming Parsing of Large Unstructured System Logs - Virtual Server List, https://users.cs.utah.edu/~lifeifei/papers/spell-tkde19.pdf 17. Spell: Streaming Parsing of System Event Logs - Virtual Server List, https://users.cs.utah.edu/~lifeifei/papers/spell.pdf 18. The Bottleneck Hypothesis Updated | SciSpace, https://scispace.com/pdf/the-bottleneck-hypothesis-updated-1ryn191c8o.pdf 19. The Police Interrogation (Chapter 2) - The Suspect's Statement - Cambridge University Press, https://www.cambridge.org/core/books/suspects-statement/police-interrogation/1AE2B8B4992C51BC679E6B2664199007 20. Terrestrial Ecosystem Mapping (TEM) with Wildlife Habitat Interpretations for the Akie and Pesika Landscape Units of the - Gov.bc.ca, https://a100.gov.bc.ca/pub/acat/documents/r1589/tem_182_rpt_1097186784374_94ad9bfb80594491a2268607b8d227c3.pdf 21. Computing the Parameterized Burrows–Wheeler Transform Online - GitHub Pages, https://koeppl.github.io/bin/paper/spire22pbwt.m.pdf 22. Parameterized Duplication in Strings: Algorithms and an Application to Software Maintenance | SIAM Journal on Computing, https://epubs.siam.org/doi/10.1137/S0097539793246707 23. Reconstructing Parameterized Strings from Parameterized Suffix and LCP Arrays | Request PDF - ResearchGate, https://www.researchgate.net/publication/374937021_Reconstructing_Parameterized_Strings_from_Parameterized_Suffix_and_LCP_Arrays 24. Spell Streaming Parsing of System Event Logs | PDF - Scribd, https://www.scribd.com/document/714227549/Spell-Streaming-Parsing-of-System-Event-Logs 25. The entire SEQUITUR algorithm. | Download Scientific Diagram - ResearchGate, https://www.researchgate.net/figure/The-entire-SEQUITUR-algorithm_fig1_2826982 26. Inferring Sequential Structure - Sequitur, http://www.sequitur.info/Nevill-Manning.pdf 27. Efficient Document Analytics on Compressed Data: Method, Challenges, Algorithms, Insights - Ethz, https://people.inf.ethz.ch/omutlu/pub/compression-based-direct-processing-on-data_vldb18.pdf 28. The Generalized Smallest Grammar Problem 1. Introduction, http://proceedings.mlr.press/v57/siyari16.pdf 29. Sequitur-based Inference and Analysis Framework for Malicious System Behavior - SciTePress, https://www.scitepress.org/papers/2017/62502/62502.pdf 30. Joint Learning Templates and Slots for Event Schema Induction - ResearchGate, https://www.researchgate.net/publication/305334294_Joint_Learning_Templates_and_Slots_for_Event_Schema_Induction 31. Joint optimization of wrapper generation and template detection - ResearchGate, https://www.researchgate.net/publication/221653138_Joint_optimization_of_wrapper_generation_and_template_detection 32. Mapping a lateralization gradient within the ventral stream for auditory speech perception, https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2013.00629/full 33. Revealing the dual streams of speech processing - PNAS, https://www.pnas.org/doi/10.1073/pnas.1614038114 34. Lecture 13: Minimum Description Length, https://www.cs.cmu.edu/~aarti/Class/10704/lec13-MDL.pdf 35. FIDEX: Filtering Spreadsheet Data using Examples - Microsoft, https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/oopsla16-spreadsheet.pdf 36. Predicting a Correct Program in Programming By Example - People | MIT CSAIL, https://people.csail.mit.edu/rishabh/papers/cav15-ranking.pdf 37. Wrapper Maintenance: A Machine Learning Approach - Journal of Artificial Intelligence Research, https://jair.org/index.php/jair/article/download/10325/24668/19045 38. AUTOMATICALLY EVOLVING RULE INDUCTION ALGORITHMS WITH GRAMMAR-BASED GENETIC PROGRAMMING - Kent Academic Repository, https://kar.kent.ac.uk/86357/1/445792.pdf 39. RoadRunner: Towards Automatic Data Extraction from Large Web Sites - VLDB Endowment, https://www.vldb.org/conf/2001/P109.pdf 40. Predictive Brain Mechanisms in Sound-to-Meaning Mapping during Speech Processing, https://pmc.ncbi.nlm.nih.gov/articles/PMC6601890/
