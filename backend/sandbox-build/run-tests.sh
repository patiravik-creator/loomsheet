#!/usr/bin/env bash
# Compiles and runs the plain-Java service layer + its JUnit 5 tests using
# apt-installed jars as the classpath, entirely offline. This bypasses
# Maven (blocked in this sandbox) and does NOT touch the Spring Boot
# controller/application classes, which depend on spring-boot-starter-web
# and cannot be compiled without Maven Central access.
#
# Usage: ./run-tests.sh [SingleTestClassSimpleName]
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_ROOT=".."
SRC_MAIN="$PROJECT_ROOT/src/main/java"
SRC_TEST="$PROJECT_ROOT/src/test/java"
OUT_MAIN="classes"
OUT_TEST="test-classes"

JARS="/usr/share/java/pdfbox2-2.0.29.jar:/usr/share/java/fontbox2-2.0.29.jar:/usr/share/java/xmpbox-2.0.29.jar:/usr/share/java/poi-4.0.1.jar:/usr/share/java/commons-logging.jar:/usr/share/java/commons-compress.jar:/usr/share/java/commons-codec.jar"
JUNIT_CONSOLE="/usr/share/java/junit-platform-console-standalone-1.9.1.jar"
JUNIT_API="/usr/share/java/junit-jupiter-api-5.10.1.jar:/usr/share/java/junit-jupiter-engine-5.10.1.jar:/usr/share/java/junit-jupiter-params-5.10.1.jar:/usr/share/java/junit-platform-commons-1.9.1.jar:/usr/share/java/junit-platform-engine-1.9.1.jar"

mkdir -p "$OUT_MAIN" "$OUT_TEST"

echo "== Finding only the plain-Java sources (service, model, dto, exception — NOT controller/config/*Application) =="
MAIN_SOURCES=$(find "$SRC_MAIN" -name "*.java" \
    ! -path "*/controller/*" \
    ! -path "*/config/*" \
    ! -path "*/dto/*" \
    ! -name "*Application.java" \
    ! -name "ApiExceptionHandler.java")

echo "== Compiling main sources =="
javac -encoding UTF-8 -d "$OUT_MAIN" -cp "$JARS" $MAIN_SOURCES

echo "== Copying main resources (fonts, etc.) =="
if [ -d "$PROJECT_ROOT/src/main/resources" ]; then
  cp -r "$PROJECT_ROOT/src/main/resources/." "$OUT_MAIN/"
fi

echo "== Compiling test sources (service-layer tests only; controller ITs need spring-boot-starter-test) =="
TEST_SOURCES=$(find "$SRC_TEST" -name "*.java" ! -path "*/controller/*")
javac -encoding UTF-8 -d "$OUT_TEST" -cp "$OUT_MAIN:$JARS:$JUNIT_API" $TEST_SOURCES

echo "== Running tests =="
FILTER=""
if [ "${1:-}" != "" ]; then
  FILTER="-c com.loomsheet.backend.service.$1"
else
  FILTER="--scan-classpath=$OUT_TEST"
fi

java -Djava.awt.headless=true -cp "$OUT_MAIN:$OUT_TEST:$JARS" -jar "$JUNIT_CONSOLE" \
  --disable-banner \
  --classpath "$OUT_MAIN:$OUT_TEST:$JARS" \
  $FILTER
