import os

file_path = r"c:\Users\rohin\Downloads\think\think\frontend\src\pages\RequirementCreate.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replacement block
old_block = """            // Autofill high-level fields from parsed JD
            setForm((prev) => ({
                ...prev,
                location: parsed.location || prev.location,
                notice_period: parsed.notice_period || prev.notice_period,
                years_of_experience: parsed.years_of_experience || prev.years_of_experience,
                mode_of_work: parsed.mode_of_work || prev.mode_of_work,
            }));"""

new_block = """            // Autofill high-level fields from parsed JD
            setForm((prev) => ({
                ...prev,
                company_name: parsed.company_name || prev.company_name,
                requirement_name: parsed.requirement_name || prev.requirement_name,
                requirement_type: parsed.requirement_type || prev.requirement_type,
                role_type: parsed.role_type || prev.role_type,
                location: parsed.location || prev.location,
                notice_period: parsed.notice_period || prev.notice_period,
                years_of_experience: parsed.years_of_experience || prev.years_of_experience,
                mode_of_work: parsed.mode_of_work || prev.mode_of_work,
            }));"""

# Replace all occurrences (one for file, one for text)
new_content = content.replace(old_block, new_block)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Frontend file updated successfully.")
