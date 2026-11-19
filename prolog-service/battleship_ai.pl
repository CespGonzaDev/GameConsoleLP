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
    is_active_hit/3
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

% Helper: Check if cell is blocked for ship placement (already shot with MISS or SUNK)
is_blocked_for_placement(Shots, R, C) :-
    member(shot(R, C, Result, Sunk), Shots),
    (   Result == 'MISS'
    ;   is_hit_sunk(Shots, R, C, Sunk)
    ).

is_hit_sunk(_Shots, _R, _C, Sunk) :-
    Sunk \== null, Sunk \== 'null', Sunk \== none, Sunk \== ''.

% A hit is active if it's a HIT and NOT part of any sunk ship
is_active_hit(Shots, R, C) :-
    member(shot(R, C, 'HIT', Sunk), Shots),
    \+ is_hit_sunk(Shots, R, C, Sunk),
    \+ connected_to_sunk(Shots, R, C).

% Directly marked as sunk
directly_sunk(Shots, R, C) :-
    member(shot(R, C, 'HIT', Sunk), Shots),
    is_hit_sunk(Shots, R, C, Sunk).

% Check if (R, C) is connected through a contiguous line of HITs to a directly_sunk cell
connected_to_sunk(Shots, R, C) :-
    directly_sunk(Shots, SR, SC),
    path_of_hits(Shots, R, C, SR, SC, [pos(R, C)]).

path_of_hits(_, R, C, R, C, _).
path_of_hits(Shots, R, C, TargetR, TargetC, Visited) :-
    orthogonal_neighbor(R, C, NR, NC),
    member(shot(NR, NC, 'HIT', _), Shots),
    \+ member(pos(NR, NC), Visited),
    path_of_hits(Shots, NR, NC, TargetR, TargetC, [pos(NR, NC) | Visited]).

% -------------------------------------------------------------------------
% TARGET MODE
% -------------------------------------------------------------------------
target_move(Rows, Cols, Shots, RemainingLengths, Difficulty, Row, Col, Heuristic) :-
    % 1. Find all active hits
    findall(pos(R, C), is_active_hit(Shots, R, C), ActiveHits),
    ActiveHits \= [],
    % 2. Look for aligned/contiguous hits of length >= 2
    (   find_line_target(Rows, Cols, Shots, ActiveHits, Row, Col, Heuristic)
    ;   % 3. If no line endpoints available, try orthogonal neighbors of active hits
        find_orthogonal_target(Rows, Cols, Shots, RemainingLengths, ActiveHits, Difficulty, Row, Col, Heuristic)
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
find_orthogonal_target(Rows, Cols, Shots, RemainingLengths, ActiveHits, Difficulty, Row, Col, Heuristic) :-
    member(pos(HR, HC), ActiveHits),
    orthogonal_neighbor(HR, HC, R, C),
    valid_unshot_cell(Rows, Cols, Shots, R, C),
    (   (Difficulty == 'hard' ; Difficulty == 'tactical')
    ->  min_length(RemainingLengths, MinLen),
        (ship_fits(R, C, MinLen, Rows, Cols, Shots) -> true ; true)
    ;   true
    ),
    Row = R, Col = C,
    Heuristic = 'TARGET_ORTHOGONAL_NEIGHBOR'.

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
    MaxR is Rows - 1,
    MaxC is Cols - 1,
    % 1. Primary Hunt: Parity (R + C mod 2 = 0) and Ship Fits
    (   findall(pos(R, C), (
            between(0, MaxR, R),
            between(0, MaxC, C),
            (R + C) mod 2 =:= 0,
            \+ is_shot(Shots, R, C),
            ship_fits(R, C, MinLen, Rows, Cols, Shots)
        ), ParityCandidates),
        ParityCandidates \= [],
        select_best_candidate(ParityCandidates, Rows, Cols, Difficulty, Row, Col),
        Heuristic = 'HUNT_PARITY_FIT'
    ;   % 2. Relaxed Hunt: Ship fits regardless of parity
        findall(pos(R, C), (
            between(0, MaxR, R),
            between(0, MaxC, C),
            \+ is_shot(Shots, R, C),
            ship_fits(R, C, MinLen, Rows, Cols, Shots)
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
    (   Len =< 1
    ->  true
    ;   fits_horizontal(R, C, Len, Cols, Shots)
    ;   fits_vertical(R, C, Len, Rows, Shots)
    ).

fits_horizontal(R, C, Len, Cols, Shots) :-
    MaxOffset is Len - 1,
    between(0, MaxOffset, Offset),
    StartCol is C - Offset,
    EndCol is StartCol + Len - 1,
    StartCol >= 0,
    EndCol < Cols,
    check_span_horizontal(R, StartCol, EndCol, Shots),
    !.

check_span_horizontal(R, Col, EndCol, Shots) :-
    (   Col > EndCol
    ->  true
    ;   \+ is_blocked_for_placement(Shots, R, Col),
        NextCol is Col + 1,
        check_span_horizontal(R, NextCol, EndCol, Shots)
    ).

fits_vertical(R, C, Len, Rows, Shots) :-
    MaxOffset is Len - 1,
    between(0, MaxOffset, Offset),
    StartRow is R - Offset,
    EndRow is StartRow + Len - 1,
    StartRow >= 0,
    EndRow < Rows,
    check_span_vertical(StartRow, EndRow, C, Shots),
    !.

check_span_vertical(Row, EndRow, C, Shots) :-
    (   Row > EndRow
    ->  true
    ;   \+ is_blocked_for_placement(Shots, Row, C),
        NextRow is Row + 1,
        check_span_vertical(NextRow, EndRow, C, Shots)
    ).
