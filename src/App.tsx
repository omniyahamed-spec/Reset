async function saveProfile() {
  setProfileError("");

  const {
    data: { user: currentUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !currentUser) {
    setProfileError("You need to log in again before saving your profile.");
    setScreen("auth");
    return;
  }

  if (!profileName.trim()) {
    setProfileError("Name is required.");
    return;
  }

  const ageNumber = profileAge.trim() ? Number(profileAge) : null;

  if (
    ageNumber !== null &&
    (!Number.isFinite(ageNumber) || ageNumber < 13 || ageNumber > 120)
  ) {
    setProfileError("Enter a valid age.");
    return;
  }

  const payload = {
    id: currentUser.id,
    name: profileName.trim(),
    age: ageNumber,
    country: profileCountry.trim() || null,
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error("Profile save error:", error);
    setProfileError(error.message);
    return;
  }

  setUser(currentUser);
  setProfile(data as Profile);
  setScreen("start");
}
