// Portable release archive path checker. It never extracts or executes files.
#include <algorithm>
#include <cctype>
#include <iostream>
#include <set>
#include <string>
#include <vector>

static bool safe_path(std::string value) {
  if (value.empty() || value.size() > 240 || value.front() == '/') return false;
  if (value.back() == '/') value.pop_back();
  if (value.empty()) return false;
  for (unsigned char c : value) if (c < 32 || c > 126 || c == '\\' || c == ':') return false;
  std::size_t start = 0;
  while (start <= value.size()) {
    const auto end = value.find('/', start);
    auto part = value.substr(start, end == std::string::npos ? end : end - start);
    if (part.empty() || part == "." || part == ".." || part.back() == '.' || part.back() == ' ') return false;
    std::transform(part.begin(), part.end(), part.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (part == ".git" || part == ".dev.vars" || part == ".env" || part.rfind(".env.", 0) == 0) return false;
    auto stem = part.substr(0, part.find('.'));
    if (stem == "con" || stem == "prn" || stem == "aux" || stem == "nul" ||
        (stem.size() == 4 && (stem.rfind("com", 0) == 0 || stem.rfind("lpt", 0) == 0) && stem[3] >= '0' && stem[3] <= '9')) return false;
    if (end == std::string::npos) break;
    start = end + 1;
  }
  return true;
}
int main(int argc, char** argv) {
  if (argc == 2 && std::string(argv[1]) == "--self-test") {
    const std::vector<std::string> bad = {"../escape", "/root/a", "C:/temp/a", "safe/../a", "safe//a", "./a", "a/./b", "a\\b", "safe/a:stream", "CON.txt", "x/NUL", "LPT1.log", "a/.", "a/b.", "a/b ", "a/.env", "a/.env.production", ".git/config", std::string("a\0b", 3), std::string(241, 'x')};
    for (const auto& p : bad) if (safe_path(p)) return 1;
    for (const auto& p : {"WarLike Mail/WarLike-Mail.exe", "app/lib/bridge.ts", "runtimes/win-x64/native/WebView2Loader.dll", "folder/"}) if (!safe_path(p)) return 1;
    std::cout << bad.size() + 4 << " archive path checks passed\n"; return 0;
  }
  std::string line; std::set<std::string> seen; std::size_t count = 0;
  while (std::getline(std::cin, line)) {
    if (++count > 4096 || !safe_path(line)) { std::cerr << "Unsafe archive path\n"; return 1; }
    if (line.back() == '/') line.pop_back();
    std::transform(line.begin(), line.end(), line.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (!seen.insert(line).second) { std::cerr << "Duplicate or case-colliding archive path\n"; return 1; }
  }
  if (!count || std::cin.bad()) return 1;
  std::cout << count << " archive paths accepted\n";
}
