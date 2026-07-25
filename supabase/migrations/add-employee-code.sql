-- Add payroll / attendance sheet employee IDs (e.g. 0001, 0210)
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employee_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_employee_code
  ON employees (employee_code)
  WHERE employee_code IS NOT NULL AND employee_code <> '';

COMMIT;

-- Backfill employee_code from attendance sheet (38 mapped employees)
BEGIN;
UPDATE employees SET employee_code = '0001' WHERE lower(email) = 'preetam.tailam@malconnexus.com'; -- PREETHAM TAILAM
UPDATE employees SET employee_code = '0002' WHERE lower(email) = 'shireesha.tailam@malconnexus.com'; -- TAILAM SHIREESHA
UPDATE employees SET employee_code = '0014' WHERE lower(email) = 'chandra.gajelli@malconnexus.com'; -- GAJELLI CHANDRA PRANEETH
UPDATE employees SET employee_code = '0028' WHERE lower(email) = 'kiran.paka@malconnexus.com'; -- PAKA KIRAN KUMAR
UPDATE employees SET employee_code = '0042' WHERE lower(email) = 'chiranjeevi.nagavath@malconnexus.com'; -- NAGAVATH CHIRANJEEVI
UPDATE employees SET employee_code = '0074' WHERE lower(email) = 'ramesh.palla@malconnexus.com'; -- PALLA RAMESH
UPDATE employees SET employee_code = '0086' WHERE lower(email) = 'ganesh.madka@malconnexus.com'; -- MADKA GANESH
UPDATE employees SET employee_code = '0089' WHERE lower(email) = 'srinivas.dolli@malconnexus.com'; -- DOLLI SRINIVAS
UPDATE employees SET employee_code = '0092' WHERE lower(email) = 'govind.dasari@malconnexus.com'; -- D GOVIND
UPDATE employees SET employee_code = '0091' WHERE lower(email) = 'prem.kumarbekkam@malconnexus.com'; -- BEKKAM PREM KUMAR
UPDATE employees SET employee_code = '0100' WHERE lower(email) = 'prashanth.javaji@malconnexus.com'; -- JAVAJI PRASHANTH
UPDATE employees SET employee_code = '0101' WHERE lower(email) = 'vijaykumar.jeripothula@malconnexus.com'; -- JERIPOTHULA VIJAYKUMAR
UPDATE employees SET employee_code = '0113' WHERE lower(email) = 'saikrishna.jeripothula@malconnexus.com'; -- JERIPOTHULA SAI KRISHNA
UPDATE employees SET employee_code = '0118' WHERE lower(email) = 'surya.jillala@malconnexus.com'; -- JILLALA SURYA
UPDATE employees SET employee_code = '0138' WHERE lower(email) = 'bindhu.seerla@malconnexus.com'; -- SEERALA BINDU
UPDATE employees SET employee_code = '0143' WHERE lower(email) = 'srivani.adire@malconnexus.com'; -- ADIRE SRIVANI
UPDATE employees SET employee_code = '0145' WHERE lower(email) = 'srinu.thamadi@malconnexus.com'; -- THAMADI SRINU
UPDATE employees SET employee_code = '0161' WHERE lower(email) = 'ramakanth.perumandla@malconnexus.com'; -- PERUMANDLA RAMAKANTH
UPDATE employees SET employee_code = '0163' WHERE lower(email) = 'vinay.jakati@malconnexus.com'; -- JAKATI VINAY
UPDATE employees SET employee_code = '0165' WHERE lower(email) = 'shivaji.bashaboina@malconnexus.com'; -- BASHABOINA SHIVAJI
UPDATE employees SET employee_code = '0169' WHERE lower(email) = 'vinithgoud.burlawar@malconnexus.com'; -- BURLAWAR VINEETH GOUD
UPDATE employees SET employee_code = '0175' WHERE lower(email) = 'rajesh.muppu@malconnexus.com'; -- MUPPA RAJESH
UPDATE employees SET employee_code = '0181' WHERE lower(email) = 'rajesh.k@malconnexus.com'; -- K.RAJESH
UPDATE employees SET employee_code = '0183' WHERE lower(email) = 'devendhar.chatlapalli@malconnexus.com'; -- CHATLAPALLI DEVENDHAR
UPDATE employees SET employee_code = '0187' WHERE lower(email) = 'praveen.gandamalla@malconnexus.com'; -- GANDAMALLA PRAVEEN KUMAR
UPDATE employees SET employee_code = '0188' WHERE lower(email) = 'nithin.jatoth@malconnexus.com'; -- J.NITHIN
UPDATE employees SET employee_code = '0189' WHERE lower(email) = 'sai.patakaula@malconnexus.com'; -- PATAKULA SAI
UPDATE employees SET employee_code = '0190' WHERE lower(email) = 'swamy.katla@malconnexus.com'; -- K.SWAMY
UPDATE employees SET employee_code = '0203' WHERE lower(email) = 'rachitha.abburi@malconnexus.com'; -- S.RACHITHA  SAI
UPDATE employees SET employee_code = '0204' WHERE lower(email) = 'arunkumar.gopu@malconnexus.com'; -- G.ARUN KUMAR
UPDATE employees SET employee_code = '0205' WHERE lower(email) = 'nithin.thaduri@malconnexus.com'; -- THADURI NITHIN
UPDATE employees SET employee_code = '0208' WHERE lower(email) = 'siddhartha.kallepelly@malconnexus.com'; -- K.SIDDARTHA
UPDATE employees SET employee_code = '0209' WHERE lower(email) = 'pavani.k@malconnexus.com'; -- PAVANI.K
UPDATE employees SET employee_code = '0210' WHERE lower(email) = 'jeevan.anishetti@malconnexus.com'; -- A.JEEVAN
UPDATE employees SET employee_code = '0211' WHERE lower(email) = 'prabhakar.junjur@malconnexus.com'; -- JUNJUR.PRABHAKAR
UPDATE employees SET employee_code = '0212' WHERE lower(email) = 'harshavardhan.jangili@malconnexus.com'; -- HARSHAVARDHAN
UPDATE employees SET employee_code = '0214' WHERE lower(email) = 'anusha.chigurupati@malconnexus.com'; -- CH.ANUSHA
UPDATE employees SET employee_code = '0215' WHERE lower(email) = 'sarada.m@malconnexus.com'; -- M.SARADA
COMMIT;
