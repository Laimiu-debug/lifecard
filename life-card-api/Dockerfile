# Build stage
FROM rust:1.75-slim-bookworm as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations

# Build release binary
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/target/release/life_card_api /app/life_card_api
COPY --from=builder /app/migrations /app/migrations

# Create uploads directory
RUN mkdir -p /app/uploads/avatars /app/uploads/media

# Expose port
EXPOSE 8080

# Set environment variables
ENV APP_HOST=0.0.0.0
ENV APP_PORT=8080
ENV RUST_LOG=info,life_card_api=debug

# Run the application
CMD ["/app/life_card_api"]
