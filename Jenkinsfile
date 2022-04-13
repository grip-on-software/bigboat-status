pipeline {
    agent { label 'docker' }

    environment {
        IMAGE_TAG = env.BRANCH_NAME.replaceFirst('^master$', 'latest')
        GITLAB_TOKEN = credentials('bigboat-status-gitlab-token')
        SCANNER_HOME = tool name: 'SonarQube Scanner 3', type: 'hudson.plugins.sonar.SonarRunnerInstallation'
    }

    options {
        gitLabConnection('gitlab')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }
    triggers {
        gitlab(triggerOnPush: true, triggerOnMergeRequest: true, branchFilterType: 'All', secretToken: env.GITLAB_TOKEN)
        cron(env.BIGBOAT_STATUS_CRON)
    }

    post {
        failure {
            updateGitlabCommitStatus name: env.JOB_NAME, state: 'failed'
        }
        aborted {
            updateGitlabCommitStatus name: env.JOB_NAME, state: 'canceled'
        }
    }

    stages {
        stage('Start') {
            when {
                expression {
                    currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                }
            }
            steps {
                updateGitlabCommitStatus name: env.JOB_NAME, state: 'running'
            }
        }
        stage('Build') {
            steps {
                sh 'docker build -t $DOCKER_REGISTRY/gros-bigboat-status:$IMAGE_TAG . --build-arg NPM_REGISTRY=$NPM_REGISTRY'
            }
        }
        stage('SonarQube Analysis') {
            when {
                expression {
                    currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                }
            }
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '${SCANNER_HOME}/bin/sonar-scanner -Dsonar.projectKey=bigboat-status:$BRANCH_NAME -Dsonar.projectName="BigBoat Status $BRANCH_NAME"'
                }
            }
        }
        stage('Push') {
            when { branch 'master' }
            steps {
                sh 'docker push $DOCKER_REGISTRY/gros-bigboat-status:latest'
            }
        }
        stage('Collect') {
            when {
                anyOf {
                    branch 'master'
                    expression {
                        currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                    }
                }
            }
            agent {
                docker {
                    image "${env.DOCKER_REGISTRY}/gros-data-analysis-dashboard"
                    args '--tmpfs /tmp'
                    reuseNode true
                }
            }
            steps {
                withCredentials([file(credentialsId: 'data-analysis-config', variable: 'ANALYSIS_CONFIGURATION')]) {
                    sh '/bin/bash -c "rm -rf $PWD/output && mkdir $PWD/output && cd /home/docker && Rscript report.r --report bigboat_status --project-metadata \\"\\" --project-sources bigboat $REPORT_PARAMS --log INFO --config $ANALYSIS_CONFIGURATION --output $PWD/output"'
                }
            }
        }
        stage('Visualize') {
            when {
                anyOf {
                    branch 'master'
                    expression {
                        currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                    }
                }
            }
            agent {
                docker {
                    image "${env.DOCKER_REGISTRY}/gros-bigboat-status:${env.IMAGE_TAG}"
                    reuseNode true
                }
            }
            steps {
                withCredentials([file(credentialsId: 'bigboat-status-config', variable: 'BIGBOAT_STATUS_CONFIGURATION')]) {
                    sh 'rm -rf public/data/'
                    sh 'mkdir -p public/'
                    sh 'mv output/ public/data/'
                    sh 'rm -rf node_modules/'
                    sh 'ln -s /usr/src/app/node_modules .'
                    sh 'MIX_FILE=$WORKSPACE/webpack.mix.js npm run production'
                }
                publishHTML([allowMissing: false, alwaysLinkToLastBuild: false, keepAll: false, reportDir: 'public', reportFiles: 'index.html', reportName: 'Visualization', reportTitles: ''])
            }
        }
        stage('Status') {
            when {
                expression {
                    currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                }
            }
            steps {
                updateGitlabCommitStatus name: env.JOB_NAME, state: 'success'
            }
        }
    }
}
