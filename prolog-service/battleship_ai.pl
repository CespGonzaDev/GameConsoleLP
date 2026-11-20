/* =========================================================================
   battleship_ai.pl - Battleship AI Decision Engine in SWI-Prolog
   GameConsole - Carril C (Microservicio Prolog IA)
   ========================================================================= */

:- module(battleship_ai, [
    solve_move/9,
    target_move/8,
    hunt_move/8,
    ship_fits/6,
    is_shot/3,
    is_blocked_for_placement/3,
    is_active_hit/3,
    sunk_cells/2
]).

:- use_module(library(lists)).

% -------------------------------------------------------------------------
% solve_move(+Rows, +Cols, +Shots, +RemainingLengths, +Difficulty, -Row, -Col, -Mode, -Heuristic)
% -------------------------------------------------------------------------
solve_move(Rows, Cols, Shots, RemainingLengths, Difficulty, Row, Col, Mode, Heuristic) :-
    (   % Try TARGET mode first if there are active hits
        target_move(Rows, Cols, Shots, RemainingLengths, Difficulty, TargetR, TargetC, TargetH)
    ->  Row = TargetR, Col = TargetC, Mode = 'TARGET', Heuristic = TargetH
    ;   % Otherwise use HUNT mode
        hunt_move(Rows, Cols, Shots, RemainingLengths, Difficulty, HuntR, HuntC, HuntH),
        Row = HuntR, Col = HuntC, Mode = 'HUNT', Heuristic = HuntH
    ), !.

% -------------------------------------------------------------------------
% Helper: Check if cell (R, C) was already shot
% -------------------------------------------------------------------------
is_shot(Shots, R, C) :-
    member(shot(R, C, _, _), Shots).

% Helper: Check if cell is blocked for ship placement (already shot with MISS or part of a sunk ship)
is_blocked_for_placement(Shots, R, C) :-
    sunk_cells(Shots, Sunk),
    blocked(Shots, Sunk, R, C).

blocked(Shots, Sunk, R, C) :-
    (   memberchk(pos(R, C), Sunk)
    ;   member(shot(R, C, 'MISS', _), Shots)
    ), !.

is_sunk_name(Sunk) :-
    Sunk \== null, Sunk \== 'null', Sunk \== none, Sunk \== ''.

% A hit is active if it's a HIT and NOT part of any sunk ship
is_active_hit(Shots, R, C) :-
    sunk_cells(Shots, Sunk),
    active_hit(Shots, Sunk, R, C).

active_hit(Shots, Sunk, R, C) :-
    member(shot(R, C, 'HIT', _), Shots),
    \+ memberchk(pos(R, C), Sunk).

% -------------------------------------------------------------------------
% Sunk ship reconstruction.
% The client only flags the LAST hit of a ship with its name (shipSunk).
% A ship of known length L occupies a straight segment of L HIT cells that
% contains that last hit. Only hits shot BEFORE the sinking shot (and not yet
% claimed by another ship) can belong to it, which disambiguates adjacent ships.
% Among several valid segments the one made of the most recent shots wins.
% -------------------------------------------------------------------------
ship_length('Aircraft Carrier', 5).
ship_length('Carrier', 5).
ship_length('Battleship', 4).
ship_length('Cruiser', 3).
ship_length('Submarine', 3).
ship_length('Destroyer', 2).
ship_length('Patrol Boat', 2).

sunk_length(Name, Len) :-
    (   ship_length(Name, L) -> Len = L ; Len = 2 ).

% sunk_cells(+Shots, -Cells): Cells is a list of pos(R,C) belonging to sunk ships
sunk_cells(Shots, Cells) :-
    sunk_pass(Shots, [], [], Cells).

sunk_pass([], _, Acc, Acc).
sunk_pass([shot(R, C, Res, Sunk) | T], Prefix, Acc, Cells) :-
    (   Res == 'HIT', is_sunk_name(Sunk)
    ->  sunk_length(Sunk, Len),
        (   best_sunk_segment(R, C, Len, Prefix, Acc, Seg)
        ->  true
        ;   Seg = [pos(R, C)]
        ),
        append(Seg, Acc, Acc1)
    ;   Acc1 = Acc
    ),
    sunk_pass(T, [shot(R, C, Res, Sunk) | Prefix], Acc1, Cells).

best_sunk_segment(R, C, Len, Prefix, Claimed, Seg) :-
    findall(Score-Cells, (
        segment_through(R, C, Len, Cells),
        segment_available(Cells, R, C, Prefix, Claimed, Score)
    ), Scored),
    Scored \= [],
    keysort(Scored, Sorted),
    last(Sorted, _-Seg).

segment_through(R, C, Len, Cells) :-
    Max is Len - 1,
    between(0, Max, Off),
    (   C0 is C - Off, C0 >= 0,
        C1 is C0 + Len - 1,
        findall(pos(R, X), between(C0, C1, X), Cells)
    ;   R0 is R - Off, R0 >= 0,
        R1 is R0 + Len - 1,
        findall(pos(Y, C), between(R0, R1, Y), Cells)
    ).

% Prefix is the shot history in reverse order (most recent first)
segment_available([], _, _, _, _, 0).
segment_available([pos(R, C) | T], R, C, Prefix, Claimed, Score) :- !,
    segment_available(T, R, C, Prefix, Claimed, Score).
segment_available([pos(Y, X) | T], R, C, Prefix, Claimed, Score) :-
    nth0(Idx, Prefix, shot(Y, X, 'HIT', _)), !,
    \+ memberchk(pos(Y, X), Claimed),
    segment_available(T, R, C, Prefix, Claimed, S0),
    Score is S0 - Idx.

% -------------------------------------------------------------------------
% TARGET MODE
% -------------------------------------------------------------------------
target_move(Rows, Cols, Shots, RemainingLengths, Difficulty, Row, Col, Heuristic) :-
    % 1. Find all active hits (HITs not belonging to a sunk ship)
    sunk_cells(Shots, Sunk),
    findall(pos(R, C), active_hit(Shots, Sunk, R, C), ActiveHits),
    ActiveHits \= [],
    % 2. Look for aligned/contiguous hits of length >= 2
    (   find_line_target(Rows, Cols, Shots, ActiveHits, Row, Col, Heuristic)
    ;   % 3. If no line endpoints available, try orthogonal neighbors of active hits
        find_orthogonal_target(Rows, Cols, Shots, Sunk, RemainingLengths, ActiveHits, Difficulty, Row, Col, Heuristic)
    ).

% Detect contiguous hit groups and pick open endpoints
find_line_target(Rows, Cols, Shots, ActiveHits, Row, Col, Heuristic) :-
    (   % Horizontal line check: two active hits on same row adjacent
        member(pos(R, C1), ActiveHits),
        C2 is C1 + 1,
        member(pos(R, C2), ActiveHits),
        (   right_endpoint(Rows, Cols, Shots, ActiveHits, R, C2, Col),
            Row = R
        ;   left_endpoint(Rows, Cols, Shots, ActiveHits, R, C1, Col),
            Row = R
        ),
        Heuristic = 'TARGET_LINE_HORIZONTAL_EXTREME'
    ;   % Vertical line check: two active hits on same column adjacent
        member(pos(R1, C), ActiveHits),
        R2 is R1 + 1,
        member(pos(R2, C), ActiveHits),
        (   down_endpoint(Rows, Cols, Shots, ActiveHits, R2, C, Row),
            Col = C
        ;   up_endpoint(Rows, Cols, Shots, ActiveHits, R1, C, Row),
            Col = C
        ),
        Heuristic = 'TARGET_LINE_VERTICAL_EXTREME'
    ).

left_endpoint(Rows, Cols, Shots, ActiveHits, R, C, Col) :-
    PrevC is C - 1,
    (   member(pos(R, PrevC), ActiveHits)
    ->  left_endpoint(Rows, Cols, Shots, ActiveHits, R, PrevC, Col)
    ;   valid_unshot_cell(Rows, Cols, Shots, R, PrevC),
        Col = PrevC
    ).

right_endpoint(Rows, Cols, Shots, ActiveHits, R, C, Col) :-
    NextC is C + 1,
    (   member(pos(R, NextC), ActiveHits)
    ->  right_endpoint(Rows, Cols, Shots, ActiveHits, R, NextC, Col)
    ;   valid_unshot_cell(Rows, Cols, Shots, R, NextC),
        Col = NextC
    ).

up_endpoint(Rows, Cols, Shots, ActiveHits, R, C, Row) :-
    PrevR is R - 1,
    (   member(pos(PrevR, C), ActiveHits)
    ->  up_endpoint(Rows, Cols, Shots, ActiveHits, PrevR, C, Row)
    ;   valid_unshot_cell(Rows, Cols, Shots, PrevR, C),
        Row = PrevR
    ).

down_endpoint(Rows, Cols, Shots, ActiveHits, R, C, Row) :-
    NextR is R + 1,
    (   member(pos(NextR, C), ActiveHits)
    ->  down_endpoint(Rows, Cols, Shots, ActiveHits, NextR, C, Row)
    ;   valid_unshot_cell(Rows, Cols, Shots, NextR, C),
        Row = NextR
    ).

% Orthogonal neighbors exploration for single hits or broken lines
% On hard/tactical, neighbors where the smallest remaining ship fits are preferred;
% if the filter discards every neighbor, any unshot neighbor is used.
find_orthogonal_target(Rows, Cols, Shots, Sunk, RemainingLengths, ActiveHits, Difficulty, Row, Col, Heuristic) :-
    Heuristic = 'TARGET_ORTHOGONAL_NEIGHBOR',
    (   (Difficulty == 'hard' ; Difficulty == 'tactical'),
        min_length(RemainingLengths, MinLen),
        orthogonal_candidate(Rows, Cols, Shots, ActiveHits, R0, C0),
        ship_fits_s(R0, C0, MinLen, Rows, Cols, Shots, Sunk)
    ->  Row = R0, Col = C0
    ;   orthogonal_candidate(Rows, Cols, Shots, ActiveHits, Row, Col)
    ->  true
    ).

orthogonal_candidate(Rows, Cols, Shots, ActiveHits, R, C) :-
    member(pos(HR, HC), ActiveHits),
    orthogonal_neighbor(HR, HC, R, C),
    valid_unshot_cell(Rows, Cols, Shots, R, C).

orthogonal_neighbor(R, C, NR, C) :- NR is R - 1. % North
orthogonal_neighbor(R, C, NR, C) :- NR is R + 1. % South
orthogonal_neighbor(R, C, R, NC) :- NC is C + 1. % East
orthogonal_neighbor(R, C, R, NC) :- NC is C - 1. % West

valid_unshot_cell(Rows, Cols, Shots, R, C) :-
    R >= 0, R < Rows,
    C >= 0, C < Cols,
    \+ is_shot(Shots, R, C).

% -------------------------------------------------------------------------
% HUNT MODE (Parity & Fit Filter)
% -------------------------------------------------------------------------
hunt_move(Rows, Cols, Shots, RemainingLengths, Difficulty, Row, Col, Heuristic) :-
    min_length(RemainingLengths, MinLen),
    sunk_cells(Shots, Sunk),
    MaxR is Rows - 1,
    MaxC is Cols - 1,
    % 1. Primary Hunt: Parity (R + C mod 2 = 0) and Ship Fits
    (   findall(pos(R, C), (
            between(0, MaxR, R),
            between(0, MaxC, C),
            (R + C) mod 2 =:= 0,
            \+ is_shot(Shots, R, C),
            ship_fits_s(R, C, MinLen, Rows, Cols, Shots, Sunk)
        ), ParityCandidates),
        ParityCandidates \= [],
        select_best_candidate(ParityCandidates, Rows, Cols, Difficulty, Row, Col),
        Heuristic = 'HUNT_PARITY_FIT'
    ;   % 2. Relaxed Hunt: Ship fits regardless of parity
        findall(pos(R, C), (
            between(0, MaxR, R),
            between(0, MaxC, C),
            \+ is_shot(Shots, R, C),
            ship_fits_s(R, C, MinLen, Rows, Cols, Shots, Sunk)
        ), FitCandidates),
        FitCandidates \= [],
        select_best_candidate(FitCandidates, Rows, Cols, Difficulty, Row, Col),
        Heuristic = 'HUNT_ANY_FIT'
    ;   % 3. Fallback: Any unshot cell
        between(0, MaxR, R),
        between(0, MaxC, C),
        \+ is_shot(Shots, R, C),
        Row = R, Col = C,
        Heuristic = 'HUNT_FALLBACK_UNSHOT'
    ).

% Calculate minimum length from remaining ships list
min_length([], 2) :- !.
min_length(Lengths, Min) :-
    min_list(Lengths, Min).

% Select best candidate (tactical/hard prioritizes center or higher open space)
select_best_candidate([First | Rest], Rows, Cols, Difficulty, BestR, BestC) :-
    (   (Difficulty == 'hard' ; Difficulty == 'tactical')
    ->  CenterR is (Rows - 1) / 2.0,
        CenterC is (Cols - 1) / 2.0,
        score_candidate(First, CenterR, CenterC, FirstScore),
        find_best_candidate(Rest, CenterR, CenterC, First, FirstScore, pos(BestR, BestC))
    ;   % Easy mode or default: take head
        First = pos(BestR, BestC)
    ).

score_candidate(pos(R, C), CenterR, CenterC, Score) :-
    Dist is abs(R - CenterR) + abs(C - CenterC),
    Score is -Dist.

find_best_candidate([], _, _, BestCandidate, _, BestCandidate).
find_best_candidate([Candidate | Tail], CR, CC, CurrentBest, BestScore, FinalBest) :-
    score_candidate(Candidate, CR, CC, Score),
    (   Score > BestScore
    ->  find_best_candidate(Tail, CR, CC, Candidate, Score, FinalBest)
    ;   find_best_candidate(Tail, CR, CC, CurrentBest, BestScore, FinalBest)
    ).

% -------------------------------------------------------------------------
% Ship Fit Check: does a ship of length Len fit horizontally or vertically through (R, C)?
% -------------------------------------------------------------------------
ship_fits(R, C, Len, Rows, Cols, Shots) :-
    sunk_cells(Shots, Sunk),
    ship_fits_s(R, C, Len, Rows, Cols, Shots, Sunk).

% Same as ship_fits/6 but reuses a precomputed list of sunk cells
ship_fits_s(R, C, Len, Rows, Cols, Shots, Sunk) :-
    (   Len =< 1
    ->  true
    ;   fits_horizontal(R, C, Len, Cols, Shots, Sunk)
    ;   fits_vertical(R, C, Len, Rows, Shots, Sunk)
    ).

fits_horizontal(R, C, Len, Cols, Shots, Sunk) :-
    MaxOffset is Len - 1,
    between(0, MaxOffset, Offset),
    StartCol is C - Offset,
    EndCol is StartCol + Len - 1,
    StartCol >= 0,
    EndCol < Cols,
    check_span_horizontal(R, StartCol, EndCol, Shots, Sunk),
    !.

check_span_horizontal(R, Col, EndCol, Shots, Sunk) :-
    (   Col > EndCol
    ->  true
    ;   \+ blocked(Shots, Sunk, R, Col),
        NextCol is Col + 1,
        check_span_horizontal(R, NextCol, EndCol, Shots, Sunk)
    ).

fits_vertical(R, C, Len, Rows, Shots, Sunk) :-
    MaxOffset is Len - 1,
    between(0, MaxOffset, Offset),
    StartRow is R - Offset,
    EndRow is StartRow + Len - 1,
    StartRow >= 0,
    EndRow < Rows,
    check_span_vertical(StartRow, EndRow, C, Shots, Sunk),
    !.

check_span_vertical(Row, EndRow, C, Shots, Sunk) :-
    (   Row > EndRow
    ->  true
    ;   \+ blocked(Shots, Sunk, Row, C),
        NextRow is Row + 1,
        check_span_vertical(NextRow, EndRow, C, Shots, Sunk)
    ).
