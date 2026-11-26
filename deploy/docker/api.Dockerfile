# syntax=docker/dockerfile:1.7
# CRM API and messaging worker in one image (docs/hosting.md#images). Rust compiles on the
# builder's own CPU and cross-links for the target, so an x86_64 runner builds the arm64
# image without emulation. Build from the repository root:
#   docker buildx build -f deploy/docker/api.Dockerfile --platform linux/arm64 .
ARG RUST_IMAGE=rust:1.89-slim-bookworm
ARG RUNTIME_IMAGE=debian:bookworm-slim

FROM --platform=$BUILDPLATFORM ${RUST_IMAGE} AS build
ARG TARGETARCH
WORKDIR /src
# Map Docker's architecture to the Rust target and install a cross linker when needed.
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) triple=x86_64-unknown-linux-gnu; gnu=x86-64-linux-gnu; deb=amd64 ;; \
      arm64) triple=aarch64-unknown-linux-gnu; gnu=aarch64-linux-gnu; deb=arm64 ;; \
      *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    echo "$triple" > /rust-target; \
    if [ "$(dpkg --print-architecture)" != "$deb" ]; then \
      apt-get update; \
      apt-get install -y --no-install-recommends "gcc-$gnu" "libc6-dev-$deb-cross"; \
      rm -rf /var/lib/apt/lists/*; \
    fi; \
    rustup target add "$triple"
ENV CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
    CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc \
    CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=x86_64-linux-gnu-gcc \
    CC_x86_64_unknown_linux_gnu=x86_64-linux-gnu-gcc \
    CARGO_PROFILE_RELEASE_STRIP=symbols \
    CARGO_TERM_COLOR=never
COPY services/crm-api/ services/crm-api/
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,target=/src/services/crm-api/target,id=crm-api-target-${TARGETARCH},sharing=locked \
    set -eux; \
    triple="$(cat /rust-target)"; \
    cargo build --manifest-path services/crm-api/Cargo.toml --release --locked \
      --target "$triple" --bin kws-crm-api --bin messaging_worker; \
    mkdir -p /out; \
    cp "services/crm-api/target/$triple/release/kws-crm-api" \
       "services/crm-api/target/$triple/release/messaging_worker" /out/

FROM ${RUNTIME_IMAGE}
# No packages beyond the base: the binaries use their built-in TLS roots, and `stty`
# (coreutils) gives the trusted account command its hidden password prompt.
RUN groupadd --system --gid 10001 blaqks \
 && useradd --system --uid 10001 --gid blaqks --home-dir /app --shell /usr/sbin/nologin blaqks \
 && mkdir -p /app && chown blaqks:blaqks /app
COPY --from=build /out/kws-crm-api /out/messaging_worker /usr/local/bin/
WORKDIR /app
USER blaqks:blaqks
ENV CRM_BIND_ADDRESS=0.0.0.0:8788
EXPOSE 8788
LABEL org.opencontainers.image.title="blaqks-api" \
      org.opencontainers.image.description="Blaqks One CRM API and messaging worker"
CMD ["kws-crm-api"]
