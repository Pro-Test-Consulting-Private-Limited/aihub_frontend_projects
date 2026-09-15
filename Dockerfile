# Stage 1: Install dependencies
FROM node:24-slim
WORKDIR /app

COPY package.json package-lock.json* ./

# Try legacy-peer-deps if needed
RUN npm install --legacy-peer-deps

# Stage 2: Build
COPY . .
RUN npm run build

# Stage 3: Run
# FROM node:24-slim AS runner
ENV NODE_ENV=production
#WORKDIR /app

COPY /app .

EXPOSE 3000
CMD ["npm", "start"]