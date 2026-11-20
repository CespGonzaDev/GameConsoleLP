/* plunit tests for battleship_ai.pl
   Run:  swipl -q -g run_tests -t halt tests/battleship_ai.plt   (from prolog-service/)
*/
:- use_module(library(plunit)).
:- use_module('../battleship_ai').

:- begin_tests(hunt).

test(empty_board_parity) :-
    solve_move(10, 10, [], [5,4,3,3,2], tactical, R, C, Mode, H),
    Mode == 'HUNT', H == 'HUNT_PARITY_FIT',
    0 =:= (R + C) mod 2.

test(hunt_skips_shot_cells) :-
    solve_move(10, 10, [shot(4,5,'MISS',null), shot(5,4,'MISS',null)],
               [5,4,3,3,2], tactical, R, C, 'HUNT', _),
    \+ ( (R,C) == (4,5) ; (R,C) == (5,4) ).

test(hunt_filters_cells_where_smallest_ship_does_not_fit) :-
    % (0,0) is enclosed by misses at (0,1) and (1,0): a ship of length 2 cannot fit.
    solve_move(10, 10, [shot(0,1,'MISS',null), shot(1,0,'MISS',null)],
               [2], tactical, R, C, 'HUNT', _),
    \+ (R == 0, C == 0).

:- end_tests(hunt).

:- begin_tests(target).

test(single_hit_fires_orthogonal) :-
    solve_move(10, 10, [shot(4,4,'HIT',null)], [5,4,3,3,2], tactical, R, C, Mode, _),
    Mode == 'TARGET',
    1 =:= abs(R-4) + abs(C-4).

test(horizontal_line_fires_extreme) :-
    solve_move(10, 10, [shot(3,4,'HIT',null), shot(3,5,'HIT',null)],
               [5,4,3,3,2], tactical, R, C, 'TARGET', H),
    H == 'TARGET_LINE_HORIZONTAL_EXTREME',
    R =:= 3, memberchk(C, [3,6]).

test(vertical_line_fires_extreme) :-
    solve_move(10, 10, [shot(5,2,'HIT',null), shot(6,2,'HIT',null)],
               [5,4,3,3,2], tactical, R, C, 'TARGET', H),
    H == 'TARGET_LINE_VERTICAL_EXTREME',
    C =:= 2, memberchk(R, [4,7]).

test(blocked_extreme_uses_other_side) :-
    solve_move(10, 10, [shot(3,4,'HIT',null), shot(3,5,'HIT',null), shot(3,6,'MISS',null)],
               [5,4,3,3,2], tactical, 3, 3, 'TARGET', _).

test(orthogonal_prefers_cells_where_ship_fits) :-
    % Hit at (0,0); neighbor (0,1) is walled in by misses so a length-3 ship cannot pass
    % through it, whereas (1,0) can.
    Shots = [shot(0,0,'HIT',null), shot(0,2,'MISS',null), shot(1,1,'MISS',null)],
    solve_move(10, 10, Shots, [3], tactical, 1, 0, 'TARGET', _).

:- end_tests(target).

:- begin_tests(sunk).

test(sunk_ship_returns_to_hunt) :-
    Shots = [shot(2,2,'HIT',null), shot(2,3,'HIT','Destroyer')],
    solve_move(10, 10, Shots, [5,4,3,3], tactical, _, _, 'HUNT', _).

test(adjacent_ship_hit_stays_active) :-
    % Destroyer (len 2) sunk at (2,2)-(2,3); (3,3) was shot AFTER and belongs to another ship.
    Shots = [shot(2,2,'HIT',null), shot(2,3,'HIT','Destroyer'), shot(3,3,'HIT',null)],
    solve_move(10, 10, Shots, [5,4,3,3], tactical, R, C, 'TARGET', _),
    1 =:= abs(R-3) + abs(C-3).

test(sunk_cells_uses_ship_length) :-
    Shots = [shot(1,1,'HIT',null), shot(1,2,'HIT',null), shot(1,3,'HIT','Cruiser')],
    sunk_cells(Shots, Cells),
    msort(Cells, [pos(1,1), pos(1,2), pos(1,3)]).

test(earlier_unrelated_hit_not_claimed) :-
    % Cruiser (3) sunk along row 1; the earlier hit at (0,0) is not on that line.
    Shots = [shot(0,0,'HIT',null), shot(1,1,'HIT',null), shot(1,2,'HIT',null), shot(1,3,'HIT','Cruiser')],
    sunk_cells(Shots, Cells),
    \+ memberchk(pos(0,0), Cells).

:- end_tests(sunk).
