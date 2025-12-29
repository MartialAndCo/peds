FROM alpine:3.18
RUN apk add --no-cache curl

COPY crontab /etc/crontabs/root

# Run crond in foreground
CMD ["crond", "-f", "-d", "8"]
