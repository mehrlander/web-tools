=== MNEMONIST SUFFIXARRAY ===
props: hasArbitrarySequence, string, length, array
sa.array: Array[163]
sa.hasArbitrarySequence: false
GeneralizedSuffixArray: function

=== SUFFIX ARRAY + LCP ===
idx │ sa[i] │ lcp[i] │ suffix
  0 │   109 │      0 │ ↵Invoice·No:·11111··
  1 │    54 │     13 │ ↵Invoice·No:·67890··
  2 │   143 │      0 │ ···Total·Due:·$75.50
  3 │    17 │      2 │ ··Amount:·$100.00··T
  4 │    72 │     11 │ ··Amount:·$250.00··T
  5 │   127 │     11 │ ··Amount:·$75.50···T
  6 │    34 │      2 │ ··Total·Due:·$100.00
  7 │    89 │     14 │ ··Total·Due:·$250.00
  8 │   144 │     14 │ ··Total·Due:·$75.50
  9 │    46 │      1 │ ·$100.00↵Invoice·No:
 10 │    26 │      8 │ ·$100.00··Total·Due:
 11 │   101 │      2 │ ·$250.00↵Invoice·No:
... (151 more)

=== REPEATS (minLen=3, minFreq=2) ===
score │ freq │ len │ positions
   42 │    3 │  14 │ 34,89,144    ··Total·Due:·$
   36 │    2 │  18 │ 30,85        0.00··Total·Due:·$
   36 │    3 │  12 │ 0,55,110     Invoice·No:·
   34 │    2 │  17 │ 50,105       0.00↵Invoice·No:·
   33 │    3 │  11 │ 17,72,127    ··Amount:·$
   26 │    2 │  13 │ 0,110        Invoice·No:·1
   18 │    2 │   9 │ 25,45        :·$100.00
   18 │    2 │   9 │ 80,100       :·$250.00
   18 │    6 │   3 │ 25,45,80,100… :·$
   16 │    2 │   8 │ 135,155      :·$75.50
   16 │    4 │   4 │ 30,50,85,105 0.00
   12 │    4 │   3 │ 33,71,88,142 0··
    9 │    3 │   3 │ 122,123,124  111
    8 │    2 │   4 │ 122,123      1111

=== COVERAGE (top 10): 149/163 (91.4%) ===