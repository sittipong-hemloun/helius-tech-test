// Employee Console — CI/CD (PRD §14). Runs on the host agent labelled `employee-console`
// (Node 24, pnpm 12, Docker). Branch builds run CI only; the default branch (or DEPLOY_STAGING)
// also deploys to local staging at http://localhost:3100. Deploys are serialized.
pipeline {
  agent { label 'employee-console' }

  options {
    disableConcurrentBuilds()
    timestamps()
    timeout(time: 75, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30'))
  }

  parameters {
    booleanParam(name: 'DEPLOY_STAGING', defaultValue: false, description: 'Deploy to local staging even if this is not the default branch')
  }

  environment {
    CI = 'true'
    NEXT_TELEMETRY_DISABLED = '1'
    COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
    CI_PROJECT = "employee-console-ci-${env.BUILD_NUMBER}"
    TEST_RUN_ID = "ci${env.BUILD_NUMBER}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(returnStdout: true, script: 'git rev-parse --short=12 HEAD').trim()
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.GIT_SHA}"
        }
        sh '''
          echo "commit $(git rev-parse HEAD)"
          node --version
          corepack enable --install-directory "$WORKSPACE/.ci-bin" pnpm >/dev/null 2>&1 || true
          export PATH="$WORKSPACE/.ci-bin:$PATH"
          pnpm --version
          docker version --format 'docker {{.Server.Version}}'
        '''
      }
    }

    stage('Dependencies') {
      steps {
        sh 'export PATH="$WORKSPACE/.ci-bin:$PATH"; pnpm install --frozen-lockfile'
      }
    }

    stage('Static checks') {
      steps {
        sh '''
          export PATH="$WORKSPACE/.ci-bin:$PATH"
          pnpm lint
          pnpm typecheck
          pnpm secrets:scan
          pnpm openapi:generate
          git diff --exit-code -- packages/api-client || { echo "OpenAPI/client drift: run pnpm openapi:generate and commit"; exit 1; }
        '''
      }
    }

    stage('Unit') {
      steps {
        sh 'export PATH="$WORKSPACE/.ci-bin:$PATH"; pnpm test:unit'
      }
    }

    stage('Test DB') {
      steps {
        // Dedicated Compose project + database for this build only.
        sh 'export PATH="$WORKSPACE/.ci-bin:$PATH"; node scripts/ci-db.mjs up'
      }
    }

    stage('API') {
      steps {
        sh 'export PATH="$WORKSPACE/.ci-bin:$PATH"; pnpm test:api'
      }
    }

    stage('Build + E2E') {
      steps {
        // test:e2e makes the production builds of API + web (the only build in this pipeline).
        sh 'export PATH="$WORKSPACE/.ci-bin:$PATH"; pnpm test:e2e'
      }
    }

    stage('Postman') {
      steps {
        // Reuses the API build from the previous stage.
        sh 'export PATH="$WORKSPACE/.ci-bin:$PATH"; POSTMAN_SKIP_BUILD=1 pnpm test:postman'
      }
    }

    stage('Images') {
      steps {
        sh '''
          docker build -f infra/docker/api.Dockerfile --build-arg BUILD_COMMIT_SHA=$GIT_SHA -t employee-console/api:$GIT_SHA .
          docker build -f infra/docker/web.Dockerfile --build-arg BUILD_COMMIT_SHA=$GIT_SHA --build-arg API_INTERNAL_URL=http://api:3001 -t employee-console/web:$GIT_SHA .
        '''
      }
    }

    stage('Deploy staging') {
      when {
        anyOf {
          expression { return (env.GIT_BRANCH ?: '').endsWith('main') }
          expression { return params.DEPLOY_STAGING }
        }
      }
      steps {
        lock('employee-console-staging') {
          withCredentials([file(credentialsId: 'employee-console-staging-env', variable: 'STAGING_ENV_FILE')]) {
            // Runs the smoke checks; fails (and rolls back to the previous image) if they fail.
            sh 'export PATH="$WORKSPACE/.ci-bin:$PATH"; node scripts/staging.mjs up --tag=$GIT_SHA'
          }
        }
      }
    }
  }

  post {
    always {
      junit allowEmptyResults: true, testResults: 'test-results/*.xml'
      archiveArtifacts allowEmptyArchive: true, artifacts: 'test-results/**, playwright-report/**, .deploy/staging-manifest.json'
      // Removes only this build's Compose project and its volume — never dev or staging data.
      sh 'node scripts/ci-db.mjs down || true'
    }
  }
}
