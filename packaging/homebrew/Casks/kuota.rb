# The Homebrew cask for the Kuota desktop app.
#
# This file lives in the Kuota repository as the source of truth; each release, the
# version and the two sha256 values are filled from the real release artifacts and the
# result is attached to the release as kuota.rb and pushed to `HuakunShen/homebrew-tap`
# as `Casks/kuota.rb`.
#
# Install via:
#   brew install --cask HuakunShen/tap/kuota
#
cask "kuota" do
  arch arm: "aarch64", intel: "x64"

  version "0.1.0"
  sha256 arm:   "PENDING_RELEASE_SHA",
         intel: "PENDING_RELEASE_SHA"

  url "https://github.com/kunkunsh/kuota/releases/download/app-v#{version}/Kuota_#{version}_#{arch}.dmg"
  name "Kuota"
  desc "Truthful multi-provider AI subscription & quota monitor (Codex, Claude, Antigravity)"
  homepage "https://github.com/kunkunsh/kuota"

  livecheck do
    url "https://github.com/kunkunsh/kuota/releases/latest"
    strategy :github_latest do |json|
      json["tag_name"]&.sub(/^app-v/, "")
    end
  end

  auto_updates true

  app "Kuota.app"

  zap trash: [
    "~/Library/Application Support/sh.kunkun.kuota.desktop",
    "~/Library/WebKit/sh.kunkun.kuota.desktop",
    "~/Library/Caches/sh.kunkun.kuota.desktop",
  ]
end
