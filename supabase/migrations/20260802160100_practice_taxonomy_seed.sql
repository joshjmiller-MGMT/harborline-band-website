-- Seed from Josh 2026-08-02 (his own words) + the mined log evidence.
delete from practice_taxonomy;  -- idempotent reseed; table is config, not user data

-- ── shared value sets ────────────────────────────────────────────────
insert into practice_taxonomy (dimension,value,label,applies_to,sort_order) values
 ('parent_scale','major','Major','{Chords,Scales}',1),
 ('parent_scale','melodic_minor','Melodic minor','{Chords,Scales}',2),
 ('parent_scale','harmonic_minor','Harmonic minor','{Chords,Scales}',3),
 ('voicing','closed','Closed position','{Chords}',1),
 ('voicing','gershwin','Gershwin','{Chords}',2),
 ('voicing','drop2','Drop 2','{Chords}',3),
 ('voicing','drop3','Drop 3','{Chords}',4),
 ('voicing','drop23','Drop 2-3','{Chords}',5),
 ('voicing','drop24','Drop 2-4','{Chords}',6),
 ('spread','6ths','6ths','{Scales}',1),
 ('spread','8ves','Octaves (8s)','{Scales}',2),
 ('spread','10ths','10ths','{Scales}',3);

-- ── CHORDS methods ───────────────────────────────────────────────────
insert into practice_taxonomy (dimension,value,label,applies_to,dim2,dim3,sort_order,notes) values
 ('method','barry','Barry Harris','{Chords}','quality','voicing',1,'Barry Harris chord-movement method. Log: "Barry Harris voicing - major drop 2".'),
 ('method','bill','Bill Evans','{Chords}','quality','voicing',2,'Bill Evans voicing exercise. NOTE (Josh 8/2): distinct from the "Bill Evans lines" studied under Lines — same name, different entity, hence column-exclusive.'),
 ('method','fourths','4ths / Quartal','{Chords}','parent_scale','voicing',3,'Quartal voicings (5-voice + 3-voice). Josh 8/2: chordal, but driven by PARENT SCALES not chord qualities. 20x in the log — his dominant late-era chord method.');

-- Barry's qualities
with m as (select id from practice_taxonomy where value='barry' and dimension='method')
insert into practice_taxonomy (dimension,parent_id,value,label,applies_to,sort_order)
select 'quality', m.id, v.value, v.label, '{Chords}', v.ord from m,
 (values ('minor','Minor',1),('major','Major',2),('dom7','Dominant 7',3),('dom7b5','Dominant 7♭5',4)) as v(value,label,ord);

-- Bill Evans' qualities
with m as (select id from practice_taxonomy where value='bill' and dimension='method')
insert into practice_taxonomy (dimension,parent_id,value,label,applies_to,sort_order)
select 'quality', m.id, v.value, v.label, '{Chords}', v.ord from m,
 (values ('maj7','Major 7',1),('minmaj7','Minor-Major 7',2),('maj7s5','Major 7♯5',3)) as v(value,label,ord);

-- ── SCALES methods ───────────────────────────────────────────────────
insert into practice_taxonomy (dimension,value,label,applies_to,dim2,dim3,sort_order,notes) values
 ('method','belzer','Belzer','{Scales}','parent_scale','spread',1,
  'Belzer routine — Josh 8/2, from Prof. Belzer (director of the UMBC jazz department, Josh''s college mentor; taught it to his sax students). Melodic routine: seventh arpeggio runs down the scale to the root of the next arpeggio one scale degree up, rinse and repeat. Josh plays it in BOTH HANDS spread apart (commonly 10ths). Driven by PARENT SCALES, not chord qualities. 44x in the log — his single most-drilled item.');
