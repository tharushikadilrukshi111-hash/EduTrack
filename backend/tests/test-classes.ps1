$base = "http://localhost:5000"

$cfg = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$') { $cfg[$matches[1]] = $matches[2].Trim().Trim('"') }
}

$t = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body (@{ role="teacher"; identifier=$cfg['SEED_TEACHER_EMAIL']; password=$cfg['SEED_TEACHER_PASSWORD'] } | ConvertTo-Json)
$th = @{ Authorization = "Bearer $($t.token)" }
"Teacher: $($t.user.name)"

$s = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body (@{ role="student"; identifier=$cfg['SEED_STUDENT_REG']; password=$cfg['SEED_STUDENT_PASSWORD'] } | ConvertTo-Json)
$sh = @{ Authorization = "Bearer $($s.token)" }
"Student: $($s.user.name)"
$regNo = $cfg['SEED_STUDENT_REG'].ToUpper()

"--- 1. create class (expect 201)"
$new = Invoke-RestMethod -Method Post -Uri "$base/api/classes" -Headers $th -ContentType "application/json" -Body (@{
  name = "Grade 10 Maths"; subject = "Mathematics"; description = "Evening batch"; fee = 3500
  schedule = @(@{ day = "Monday"; startTime = "16:00"; endTime = "18:00" })
} | ConvertTo-Json -Depth 5)
$new | ConvertTo-Json -Depth 6
$cid = $new.class.id

"--- 2. invalid class (expect 400)"
try { Invoke-RestMethod -Method Post -Uri "$base/api/classes" -Headers $th -ContentType "application/json" -Body (@{ name="X"; subject="Y"; fee=-5 } | ConvertTo-Json) } catch { "Got expected error: " + $_.ErrorDetails.Message }

"--- 3. bad schedule time (expect 400)"
try { Invoke-RestMethod -Method Post -Uri "$base/api/classes" -Headers $th -ContentType "application/json" -Body (@{ name="X"; subject="Y"; fee=100; schedule=@(@{ day="Monday"; startTime="18:00"; endTime="16:00" }) } | ConvertTo-Json -Depth 5) } catch { "Got expected error: " + $_.ErrorDetails.Message }

"--- 4. update class (expect fee 4000)"
Invoke-RestMethod -Method Patch -Uri "$base/api/classes/$cid" -Headers $th -ContentType "application/json" -Body (@{ fee = 4000; description = "Updated" } | ConvertTo-Json) | ConvertTo-Json -Depth 6

"--- 5. enrol student by registration number (expect studentCount 1)"
$en = Invoke-RestMethod -Method Post -Uri "$base/api/classes/$cid/students" -Headers $th -ContentType "application/json" -Body (@{ registrationNumber = $regNo } | ConvertTo-Json)
$en | ConvertTo-Json -Depth 6
$studentDbId = $en.class.students[0].id

"--- 6. enrol the same student again (expect studentCount still 1)"
(Invoke-RestMethod -Method Post -Uri "$base/api/classes/$cid/students" -Headers $th -ContentType "application/json" -Body (@{ registrationNumber = $regNo } | ConvertTo-Json)).class.studentCount

"--- 7. teacher lists own classes"
(Invoke-RestMethod -Uri "$base/api/classes" -Headers $th).count

"--- 8. student lists enrolled classes (expect the new class, no roster)"
Invoke-RestMethod -Uri "$base/api/classes" -Headers $sh | ConvertTo-Json -Depth 6

"--- 9. student cannot create a class (expect 403)"
try { Invoke-RestMethod -Method Post -Uri "$base/api/classes" -Headers $sh -ContentType "application/json" -Body (@{ name="X"; subject="Y"; fee=1 } | ConvertTo-Json) } catch { "Got expected error: " + $_.ErrorDetails.Message }

"--- 10. remove student from class (expect studentCount 0)"
(Invoke-RestMethod -Method Delete -Uri "$base/api/classes/$cid/students/$studentDbId" -Headers $th).class.studentCount

"--- 11. student can no longer open the class (expect 403)"
try { Invoke-RestMethod -Uri "$base/api/classes/$cid" -Headers $sh } catch { "Got expected error: " + $_.ErrorDetails.Message }

"--- 12. bad id (expect 400)"
try { Invoke-RestMethod -Uri "$base/api/classes/abc" -Headers $th } catch { "Got expected error: " + $_.ErrorDetails.Message }

"--- 13. deactivate class (expect isActive False)"
Invoke-RestMethod -Method Delete -Uri "$base/api/classes/$cid" -Headers $th | ConvertTo-Json